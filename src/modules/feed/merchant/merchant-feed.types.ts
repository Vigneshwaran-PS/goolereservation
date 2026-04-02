export type MerchantEntity = {
  category: 'restaurant';
  merchant_id: string;
  name: string;
  telephone: string;
  url: string;
  geo: {
    latitude: number;
    longitude: number;
    address: {
      street_address: string;
      locality: string;
      region: string;
      postal_code: string;
      country: string;
    };
  };
};
