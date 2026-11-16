/** The delivery promise to show on cards and headers: "19 min", "2 hours", "Next day delivery". */
export function shortDelivery(home: { deliveryMins?: number; deliveryText?: string } | null | undefined): string {
  if (!home) return '19 min';
  const text = home.deliveryText || `${home.deliveryMins ?? 19} minutes`;
  return text.replace(/\bminutes?\b/i, 'min');
}
