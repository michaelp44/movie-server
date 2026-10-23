export function phoneCallHref(phone: string, hidden: boolean): string {
  return hidden ? `tel:%2331%23${phone}` : `tel:${phone}`;
}

export function displayIsraeliPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("972") ? `0${digits.slice(3)}` : phone;
}
