export type AvailabilityEntity = {
  merchant_id: string;
  service_id: string;
  start_sec: number;
  duration_sec: number;
  local_datetime?: string;
  day?: string;
  spots_total: number;
  spots_open: number;
  resources: {
    party_size: number;
  };
};

export type AvailabilityLocationResult = {
  locationId: string;
  status: 'success' | 'failed';
  records: number;
  error?: string;
};
