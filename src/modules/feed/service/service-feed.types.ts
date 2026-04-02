export type LocalizedString = {
  value: string;
  localized_value: Array<{
    locale: string;
    value: string;
  }>;
};

export type ServiceEntity = {
  merchant_id: string;
  localized_service_name: LocalizedString;
  service_id: string;
};
