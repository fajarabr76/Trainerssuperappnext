/**
 * Mask sensitive data like KTP, NPWP, or Bank Account numbers.
 * Example: "1234567890" -> "12345*****"
 */
export function maskSensitiveData(value: string | null | undefined): string {
  if (!value) return '';
  if (value.length <= 6) return value;
  
  const visibleCount = 5;
  const maskedLength = value.length - visibleCount;
  const visiblePart = value.substring(0, visibleCount);
  const mask = '*'.repeat(Math.min(maskedLength, 8)); // Limit mask to 8 chars for cleaner UI
  
  return `${visiblePart}${mask}`;
}

export function maskPesertaData(peserta: any) {
  if (!peserta) return peserta;
  
  return {
    ...peserta,
    no_ktp: peserta.no_ktp,
    no_npwp: peserta.no_npwp,
    nomor_rekening: peserta.nomor_rekening
  };
}
