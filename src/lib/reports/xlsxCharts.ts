import JSZip from 'jszip';

// ExcelJS cannot write charts, so they are added to the finished .xlsx as native DrawingML charts.
// Each chart references cell ranges and carries a value cache, so Excel shows it immediately and updates it when cells change.

const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_DRAWING = `${NS_REL}/drawing`;
const REL_CHART = `${NS_REL}/chart`;
const CT_DRAWING = 'application/vnd.openxmlformats-officedocument.drawing+xml';
const CT_CHART = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
export const EMU_PER_CM = 360000;

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const isNum = (value) => typeof value === 'number' && Number.isFinite(value);

function richText(text, size, bold) {
  return `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}"/></a:pPr>`
    + `<a:r><a:rPr lang="id-ID" sz="${size}" b="${bold ? 1 : 0}"/><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx>`;
}

function strRef(ref, values) {
  const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join('');
  return `<c:strRef><c:f>${esc(ref)}</c:f><c:strCache><c:ptCount val="${values.length}"/>${pts}</c:strCache></c:strRef>`;
}

// Non-numeric cells (a "not yet available" month) are left out of the cache, so the chart shows a gap instead of a zero.
function numRef(ref, values) {
  const pts = values.map((v, i) => (isNum(v) ? `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>` : '')).join('');
  return `<c:numRef><c:f>${esc(ref)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache></c:numRef>`;
}

const fill = (color) => `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`;

function seriesHead(s, i) {
  return `<c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>`;
}

function barSeries(chart, s, i) {
  // A single-series bar with chart.colors gives each category its own colour (e.g. emitted vs avoided vs net).
  const points = chart.colors && chart.series.length === 1
    ? chart.colors.map((color, idx) => `<c:dPt><c:idx val="${idx}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr>${fill(color)}</c:spPr></c:dPt>`).join('')
    : '';
  // Value labels keep small bars readable next to large ones (water recycling is ~0.01% of PLTS savings).
  const labels = chart.dataLabels
    ? `<c:dLbls><c:numFmt formatCode="${esc(chart.valueFormat || '#,##0')}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>`
      + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="1"/></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>'
      + '<c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>'
    : '';
  return `<c:ser>${seriesHead(s, i)}<c:spPr>${fill(s.color || chart.colors?.[0] || '64748B')}</c:spPr><c:invertIfNegative val="0"/>${points}${labels}`
    + `<c:cat>${strRef(chart.categories.ref, chart.categories.values)}</c:cat><c:val>${numRef(s.ref, s.values)}</c:val></c:ser>`;
}

function lineSeries(chart, s, i) {
  return `<c:ser>${seriesHead(s, i)}<c:spPr><a:ln w="28575" cap="rnd">${fill(s.color)}<a:round/></a:ln></c:spPr>`
    + `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${fill(s.color)}<a:ln>${fill(s.color)}</a:ln></c:spPr></c:marker>`
    + `<c:cat>${strRef(chart.categories.ref, chart.categories.values)}</c:cat><c:val>${numRef(s.ref, s.values)}</c:val><c:smooth val="0"/></c:ser>`;
}

function axes(chart) {
  const horizontal = chart.type === 'bar';
  // Ranked horizontal bars read top-down, so the category axis is reversed and the value axis is moved back to the bottom.
  const catOrientation = horizontal ? 'maxMin' : 'minMax';
  const valCrosses = horizontal ? 'max' : 'autoZero';
  const gridLine = '<c:majorGridlines><c:spPr><a:ln w="6350">' + fill('E3E7EC') + '</a:ln></c:spPr></c:majorGridlines>';
  const valTitle = chart.valueTitle ? `<c:title>${richText(chart.valueTitle, 900, false)}<c:overlay val="0"/></c:title>` : '';
  return `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="${catOrientation}"/></c:scaling><c:delete val="0"/>`
    + `<c:axPos val="${horizontal ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>`
    + `<c:tickLblPos val="nextTo"/><c:spPr><a:ln w="6350">${fill('B8C0CA')}</a:ln></c:spPr><c:crossAx val="5002"/><c:crosses val="autoZero"/>`
    + '<c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>'
    + `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? 'b' : 'l'}"/>`
    + `${gridLine}${valTitle}<c:numFmt formatCode="${esc(chart.valueFormat || '#,##0')}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>`
    + `<c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr><c:crossAx val="5001"/><c:crosses val="${valCrosses}"/><c:crossBetween val="between"/></c:valAx>`;
}

function plotArea(chart) {
  if (chart.type === 'doughnut') {
    const s = chart.series[0];
    const points = chart.colors.map((color, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${fill(color)}<a:ln w="12700">${fill('FFFFFF')}</a:ln></c:spPr></c:dPt>`).join('');
    const labels = '<c:dLbls><c:numFmt formatCode="0.0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>'
      + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="1"/></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>'
      + '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>';
    return `<c:doughnutChart><c:varyColors val="1"/><c:ser>${seriesHead(s, 0)}${points}${labels}`
      + `<c:cat>${strRef(chart.categories.ref, chart.categories.values)}</c:cat><c:val>${numRef(s.ref, s.values)}</c:val></c:ser>`
      + '<c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>';
  }

  const bars = chart.series.filter((s) => s.kind !== 'line');
  const lines = chart.series.filter((s) => s.kind === 'line');
  const stacked = chart.grouping === 'stacked';
  let xml = '';
  if (chart.type === 'line') {
    xml += `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${chart.series.map((s, i) => lineSeries(chart, s, i)).join('')}`
      + '<c:marker val="1"/><c:axId val="5001"/><c:axId val="5002"/></c:lineChart>';
    return xml + axes(chart);
  }
  xml += `<c:barChart><c:barDir val="${chart.type === 'bar' ? 'bar' : 'col'}"/><c:grouping val="${stacked ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>`
    + bars.map((s, i) => barSeries(chart, s, i)).join('')
    + `<c:gapWidth val="${stacked ? 55 : 80}"/>${stacked ? '<c:overlap val="100"/>' : '<c:overlap val="-10"/>'}<c:axId val="5001"/><c:axId val="5002"/></c:barChart>`;
  if (lines.length) {
    xml += `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lines.map((s, i) => lineSeries(chart, s, bars.length + i)).join('')}`
      + '<c:marker val="1"/><c:axId val="5001"/><c:axId val="5002"/></c:lineChart>';
  }
  return xml + axes(chart);
}

function chartXml(chart) {
  const legend = chart.series.length > 1 || chart.type === 'doughnut'
    ? `<c:legend><c:legendPos val="${chart.type === 'doughnut' ? 'r' : 'b'}"/><c:overlay val="0"/></c:legend>`
    : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${NS_REL}">`
    + '<c:roundedCorners val="0"/><c:chart>'
    + `<c:title>${richText(chart.title, 1100, true)}<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    + `<c:plotArea><c:layout/>${plotArea(chart)}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>`
    + `<c:spPr>${fill('FFFFFF')}<a:ln w="9525">${fill('D5DBE2')}</a:ln></c:spPr>`
    + `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900">${fill('3A4552')}</a:defRPr></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>`
    + '</c:chartSpace>';
}

function drawingXml(charts, firstChartNumber) {
  const anchors = charts.map((chart, i) => (
    `<xdr:oneCellAnchor><xdr:from><xdr:col>${chart.anchor.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.anchor.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
    + `<xdr:ext cx="${chart.anchor.cx}" cy="${chart.anchor.cy}"/>`
    + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Grafik ${firstChartNumber + i}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
    + '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">'
    + `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${NS_REL}" r:id="rId${i + 1}"/>`
    + '</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>'
  )).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
    + `${anchors}</xdr:wsDr>`;
}

const relsXml = (rels) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;

async function sheetPathsByName(zip) {
  const workbook = await zip.file('xl/workbook.xml').async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => [
    tag.match(/Id="([^"]+)"/)[1], tag.match(/Target="([^"]+)"/)[1],
  ] as const));
  const decode = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return new Map([...workbook.matchAll(/<sheet\b[^>]*>/g)].map(([tag]) => {
    const target = targets.get(tag.match(/r:id="([^"]+)"/)[1]).replace(/^\/?xl\//, '');
    return [decode(tag.match(/name="([^"]+)"/)[1]), `xl/${target}`];
  }));
}

// <drawing> must sit after the page setup elements and before legacyDrawing/tableParts/extLst (CT_Worksheet sequence).
function insertDrawingTag(sheetXml, relId) {
  const tag = `<drawing r:id="${relId}"/>`;
  const before = sheetXml.search(/<(legacyDrawing|legacyDrawingHF|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/);
  const at = before >= 0 ? before : sheetXml.lastIndexOf('</worksheet>');
  return sheetXml.slice(0, at) + tag + sheetXml.slice(at);
}

/**
 * @param {ArrayBuffer|Uint8Array} buffer an .xlsx produced by ExcelJS
 * @param {Array<{sheet: string, charts: object[]}>} sheetCharts charts per sheet name; see chartXml for the chart shape
 */
export async function addNativeCharts(buffer, sheetCharts) {
  const zip = await JSZip.loadAsync(buffer);
  const paths = await sheetPathsByName(zip);
  let contentTypes = await zip.file('[Content_Types].xml').async('string');
  let chartNumber = 1;
  let drawingNumber = 1;

  for (const { sheet, charts } of sheetCharts) {
    if (!charts.length) continue;
    const sheetPath = paths.get(sheet);
    if (!sheetPath) throw new Error(`Sheet "${sheet}" tidak ditemukan saat menambah grafik.`);

    const drawingPath = `xl/drawings/drawing${drawingNumber}.xml`;
    zip.file(drawingPath, drawingXml(charts, chartNumber));
    zip.file(`xl/drawings/_rels/drawing${drawingNumber}.xml.rels`, relsXml(charts.map((_, i) => (
      `<Relationship Id="rId${i + 1}" Type="${REL_CHART}" Target="../charts/chart${chartNumber + i}.xml"/>`
    )).join('')));
    contentTypes = contentTypes.replace('</Types>', `<Override PartName="/${drawingPath}" ContentType="${CT_DRAWING}"/></Types>`);

    charts.forEach((chart, i) => {
      zip.file(`xl/charts/chart${chartNumber + i}.xml`, chartXml(chart));
      contentTypes = contentTypes.replace('</Types>', `<Override PartName="/xl/charts/chart${chartNumber + i}.xml" ContentType="${CT_CHART}"/></Types>`);
    });

    const sheetFile = sheetPath.split('/').pop();
    const sheetRelsPath = sheetPath.replace(sheetFile, `_rels/${sheetFile}.rels`);
    const existingRels = zip.file(sheetRelsPath) ? await zip.file(sheetRelsPath).async('string') : relsXml('');
    const relId = 'rIdChartDrawing';
    zip.file(sheetRelsPath, existingRels.replace('</Relationships>', `<Relationship Id="${relId}" Type="${REL_DRAWING}" Target="../drawings/drawing${drawingNumber}.xml"/></Relationships>`));

    let sheetXml = await zip.file(sheetPath).async('string');
    if (!/xmlns:r=/.test(sheetXml.slice(0, 600))) sheetXml = sheetXml.replace('<worksheet ', `<worksheet xmlns:r="${NS_REL}" `);
    zip.file(sheetPath, insertDrawingTag(sheetXml, relId));

    chartNumber += charts.length;
    drawingNumber += 1;
  }

  zip.file('[Content_Types].xml', contentTypes);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
