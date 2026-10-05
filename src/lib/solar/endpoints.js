/**
 * iSolarCloud (Sungrow OpenAPI) Centralized Endpoints Configuration
 * Strict Allowlist & Security Guard
 * 
 * Verified & Permitted Endpoints (9 Endpoints):
 * 1. /openapi/login
 * 2. /openapi/getPowerStationList
 * 3. /openapi/getDeviceListByUser
 * 4. /openapi/getPVInverterRealTimeData
 * 5. /openapi/getDeviceRealTimeData
 * 6. /openapi/getOpenPointInfo
 * 7. /openapi/getDevicePointsDayMonthYearDataList
 * 8. /openapi/getFaultAlarmInfo
 * 9. /openapi/getOpenApiCallInfo
 */

export const ISOLAR_ENDPOINTS_META = {
  // --- AUTHORIZATION ---
  LOGIN: {
    path: '/openapi/login',
    category: 'Authorization',
    status: '[TERVERIFIKASI]',
    method: 'POST',
    description: 'Server-side login to acquire token'
  },

  // --- MONITORING & MASTER DATA ---
  GET_POWER_STATION_LIST: {
    path: '/openapi/getPowerStationList',
    category: 'Monitoring',
    status: '[TERVERIFIKASI]',
    method: 'POST',
    description: 'List power stations with aggregate metrics'
  },
  GET_DEVICE_LIST_BY_USER: {
    path: '/openapi/getDeviceListByUser',
    category: 'Device Management',
    status: '[TERVERIFIKASI]',
    method: 'POST',
    description: 'List inverter devices and virtual plant units per user'
  },
  GET_OPEN_POINT_INFO: {
    path: '/openapi/getOpenPointInfo',
    category: 'Metadata',
    status: '[TERVERIFIKASI]',
    method: 'POST',
    description: 'Query available measurement points and unit definitions'
  },
  GET_OPEN_API_CALL_INFO: {
    path: '/openapi/getOpenApiCallInfo',
    category: 'Diagnostics',
    status: '[TERVERIFIKASI]',
    method: 'POST',
    description: 'Query vendor rate limits and quota residue'
  },

  // --- TELEMETRY & REALTIME DATA ---
  GET_PV_INVERTER_REALTIME_DATA: {
    path: '/openapi/getPVInverterRealTimeData',
    category: 'Live Inverter Telemetry',
    status: '[TERVERIFIKASI]',
    method: 'POST',
    description: 'Inverter-level realtime telemetry (power, temperature, yield)'
  },
  GET_DEVICE_REALTIME_DATA: {
    path: '/openapi/getDeviceRealTimeData',
    category: 'Live Plant Telemetry',
    status: '[TERVERIFIKASI]',
    method: 'POST',
    description: 'Realtime telemetry points for plant virtual units (e.g. Plant PR)'
  },
  GET_FAULT_ALARM_INFO: {
    path: '/openapi/getFaultAlarmInfo',
    category: 'Alarms & Faults',
    status: '[TERVERIFIKASI]',
    method: 'POST',
    description: 'Active fault and alarm records across all stations'
  },

  // --- HISTORICAL AGGREGATION ---
  GET_DEVICE_POINTS_DAY_MONTH_YEAR_DATA_LIST: {
    path: '/openapi/getDevicePointsDayMonthYearDataList',
    category: 'Historical Telemetry',
    status: '[TERVERIFIKASI]',
    method: 'POST',
    description: 'Daily/monthly historical generation per inverter/plant point'
  },

  // --- PROHIBITED / DILARANG ---
  PARAM_SETTING: {
    path: '/openapi/paramSetting',
    category: 'Device Configuration',
    status: '[DILARANG]',
    method: 'POST',
    description: 'Device parameter setting (BLOCKED)'
  },
  PARAM_SETTING_CHECK: {
    path: '/openapi/paramSettingCheck',
    category: 'Device Configuration',
    status: '[DILARANG]',
    method: 'POST',
    description: 'Device parameter setting check (BLOCKED)'
  },
  DATA_SUBSCRIBE_START: {
    path: '/openapi/datasubscribe/start',
    category: 'Device Instruction',
    status: '[DILARANG]',
    method: 'POST',
    description: 'Direct instruction trigger to inverters (BLOCKED)'
  },
  DATA_SUBSCRIBE_STOP: {
    path: '/openapi/datasubscribe/stop',
    category: 'Device Instruction',
    status: '[DILARANG]',
    method: 'POST',
    description: 'Direct instruction trigger to inverters (BLOCKED)'
  },
  SET_POWER_CONTROL: {
    path: '/openapi/setPowerControl',
    category: 'Grid Control',
    status: '[DILARANG]',
    method: 'POST',
    description: 'Grid power dispatch control (BLOCKED)'
  },
  SET_GRID_DISPATCH: {
    path: '/openapi/setGridDispatch',
    category: 'Grid Control',
    status: '[DILARANG]',
    method: 'POST',
    description: 'Grid control command (BLOCKED)'
  }
};

/**
 * Strict allowlist containing ONLY the 9 verified, permitted endpoints.
 */
export const ALLOWED_ENDPOINTS = [
  '/openapi/login',
  '/openapi/getPowerStationList',
  '/openapi/getDeviceListByUser',
  '/openapi/getPVInverterRealTimeData',
  '/openapi/getDeviceRealTimeData',
  '/openapi/getOpenPointInfo',
  '/openapi/getDevicePointsDayMonthYearDataList',
  '/openapi/getFaultAlarmInfo',
  '/openapi/getOpenApiCallInfo'
];

/**
 * Prohibited endpoint patterns that must trigger security violation immediately.
 */
export const PROHIBITED_ENDPOINT_PATTERNS = [
  /paramSetting/i,
  /datasubscribe/i,
  /getMlpe/i,
  /getDevicePointMinuteDataList/i,
  /getDevPropertyPointValue/i,
  /^\/openapi\/set/i,
  /control/i,
  /dispatch/i,
  /write/i,
  /delete/i,
  /update/i,
  /reboot/i,
  /command/i,
  /getConfig/i,
  /getHisData/i
];

/**
 * Quota and rate-limiting configuration
 */
export const QUOTA_CONFIG = {
  HOURLY_LIMIT: 2000,
  DAILY_LIMIT: 48000,
  MONTHLY_LIMIT: 100000,
  DAILY_OPERATIONAL_TARGET: 1500,
  SOFT_LIMIT_THRESHOLD: 0.80,
  HARD_LIMIT_THRESHOLD: 0.90,
  MANUAL_REFRESH_COOLDOWN_SEC: 60,
  TIMEZONE: 'Asia/Jakarta',
  LIVE_POLLING_HOURS: { start: 5, end: 18, startMinute: 30, endMinute: 30 }, // 05:30 - 18:30 WIB
  SYS_CODE: '901'
};
