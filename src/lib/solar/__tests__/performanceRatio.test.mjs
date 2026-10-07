import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePlantPr,
  calculateCapacityWeightedPr,
  estimatePanelTemperature,
  calculateTemperatureCorrectedPr,
  calculatePearsonCorrelation,
} from '../performanceRatio.js';

describe('Performance Ratio (PR) & Temperature Correction Engine', () => {
  it('1. calculates individual plant PR correctly', () => {
    // 100 kWp plant, 120 kWh/m2 irradiation, 9000 kWh energy -> PR = 9000 / (100 * 120) = 75.0%
    const res = calculatePlantPr({
      energyKwh: 9000,
      capacityKwp: 100,
      irradiationKwhM2: 120,
      isOperational: true,
    });
    assert.equal(res.isValid, true);
    assert.equal(res.prPercent, 75.0);
  });

  it('2. capacity-weighted aggregate PR pulls closer to the large capacity plant', () => {
    // Plant A: Large (400 kWp), low PR (70%), H = 100 kWh/m2 -> E = 400 * 100 * 0.70 = 28,000 kWh
    // Plant B: Small (50 kWp), high PR (90%), H = 100 kWh/m2 -> E = 50 * 100 * 0.90 = 4,500 kWh
    // Arithmetic mean = (70 + 90) / 2 = 80.0%
    // Capacity-weighted = (28000 + 4500) / ((400*100) + (50*100)) = 32500 / 45000 = 72.22%
    const plantA = { energyKwh: 28000, capacityKwp: 400, irradiationKwhM2: 100, isOperational: true };
    const plantB = { energyKwh: 4500, capacityKwp: 50, irradiationKwhM2: 100, isOperational: true };

    const agg = calculateCapacityWeightedPr([plantA, plantB]);
    assert.equal(agg.prPercent, 72.22);
    assert.equal(agg.includedPlantCount, 2);
    assert.ok(Math.abs(agg.prPercent - 70.0) < Math.abs(agg.prPercent - 90.0), 'Must be closer to Plant A (70%)');
  });

  it('3. plant without data or under construction does not drag aggregate PR to zero', () => {
    const validPlant = { energyKwh: 12000, capacityKwp: 100, irradiationKwhM2: 150, isOperational: true }; // PR = 80.0%
    const missingEnergy = { energyKwh: null, capacityKwp: 100, irradiationKwhM2: 150, isOperational: true };
    const missingIrrad = { energyKwh: 5000, capacityKwp: 100, irradiationKwhM2: null, isOperational: true };
    const underConstruction = { energyKwh: 0, capacityKwp: 84.7, irradiationKwhM2: 150, isOperational: false };

    const agg = calculateCapacityWeightedPr([validPlant, missingEnergy, missingIrrad, underConstruction]);
    assert.equal(agg.prPercent, 80.0);
    assert.equal(agg.includedPlantCount, 1);
    assert.equal(agg.totalPlantCount, 4);
    assert.equal(agg.coveragePct, 25.0);
  });

  it('4. estimates panel temperature from daytime ambient temperature and daily GHI accurately', () => {
    // T_day = 30°C, GHI = 4.8 kWh/m2 (daytime average G = 4800 / 12 = 400 W/m2)
    // NOCT = 45°C -> T_panel = 30 + (400 / 800) * (45 - 20) = 30 + 0.5 * 25 = 42.5°C
    const tPanel = estimatePanelTemperature({
      tempDayMeanC: 30.0,
      ghiKwhM2: 4.8,
      noctC: 45.0,
    });
    assert.equal(tPanel, 42.5);
  });

  it('5. calculates temperature-corrected PR to standard 25°C baseline', () => {
    // PR = 75.0%, T_panel = 42.5°C, gamma = -0.0045 (-0.45%/°C)
    // deltaT = 42.5 - 25 = 17.5°C
    // factor = 1 + (-0.0045 * 17.5) = 1 - 0.07875 = 0.92125
    // PR_corrected = 75.0 / 0.92125 = 81.41%
    const prCorrected = calculateTemperatureCorrectedPr({
      prPercent: 75.0,
      tempPanelC: 42.5,
      gamma: -0.0045,
    });
    assert.equal(prCorrected, 81.41);
  });

  it('6. calculates Pearson correlation coefficient and handles partial months', () => {
    // Realistic dataset: warmer months exhibit lower raw PR due to thermal losses
    const points = [
      { x: 38.0, y: 76.5, isPartial: false },
      { x: 40.0, y: 75.0, isPartial: false },
      { x: 42.0, y: 73.8, isPartial: false },
      { x: 44.0, y: 72.2, isPartial: false },
      { x: 46.0, y: 70.5, isPartial: false },
      { x: 43.0, y: 78.0, isPartial: true }, // Partial month: must be excluded!
    ];

    const corr = calculatePearsonCorrelation(points);
    assert.equal(corr.count, 5);
    assert.ok(corr.r < -0.95, `Expected strong negative correlation, got ${corr.r}`);
    assert.equal(corr.direction, 'Negatif');
    assert.equal(corr.strength, 'Sangat Kuat');
  });
});
