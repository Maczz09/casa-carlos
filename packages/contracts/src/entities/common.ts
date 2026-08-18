/** Fechas ISO (`YYYY-MM-DD`), límites inclusive. Usado por cashbox y reporting para filtrar por rango. */
export interface DateRange {
  desde: string;
  hasta: string;
}
