export interface OffNutriments {
  [key: string]: number | string | undefined;
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_fi?: string;
  product_name_sv?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  nutriments?: OffNutriments;
  serving_size?: string;
  serving_quantity?: number | string;
  quantity?: string;
  nutrition_data_per?: string;
}

export interface OffApiResponse {
  code?: string;
  status?: number;
  status_verbose?: string;
  product?: OffProduct;
}
