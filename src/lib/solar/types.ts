export type NumericLike = number | string | null | undefined;

export interface FaultRecord {
  faultType?: NumericLike;
  fault_type?: NumericLike;
  [key: string]: unknown;
}

/** Station fields as returned by iSolarCloud getPowerStationList (snake_case). */
export interface VendorStationRaw {
  ps_id?: NumericLike;
  ps_name?: string;
  ps_status?: NumericLike;
  ps_fault_status?: NumericLike;
  alarm_count?: NumericLike;
  fault_count?: NumericLike;
  curr_power?: unknown;
  today_energy?: unknown;
  offline_device_count?: NumericLike;
  active_faults?: FaultRecord[];
}

/** Any plant or location shape the status helpers accept: vendor, canonical DC, or summarized row. */
export interface PlantStatusInput extends VendorStationRaw {
  id?: string;
  dcId?: string;
  name?: string;
  canonicalName?: string;
  isUnderConstruction?: boolean;
  operationalStatus?: string;
  operationalKey?: string;
  psStatus?: NumericLike;
  psFaultStatus?: NumericLike;
  faultCount?: NumericLike;
  alarmCount?: NumericLike;
  activeFaults?: FaultRecord[];
  hasFault?: boolean;
  isFault?: boolean;
  hasAlarm?: boolean;
  isAlarm?: boolean;
  isOffline?: boolean;
  isVendorOffline?: boolean;
  isOnline?: boolean;
  isWaiting?: boolean;
  status?: string;
  statusCategory?: string;
  subPlants?: PlantStatusInput[];
  offlineDeviceCount?: NumericLike;
}
