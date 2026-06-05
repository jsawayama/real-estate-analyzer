export class CalculationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "CalculationError";
    this.field = field;
  }
}

const finite = (value, field) => {
  if (!Number.isFinite(value)) {
    throw new CalculationError(`${field} は数値で入力してください`, field);
  }
  return value;
};

export function assertNonNegative(value, field) {
  finite(value, field);
  if (value < 0) {
    throw new CalculationError(`${field} は0以上で入力してください`, field);
  }
  return value;
}

export function assertPositive(value, field) {
  finite(value, field);
  if (value <= 0) {
    throw new CalculationError(`${field} は0より大きい値で入力してください`, field);
  }
  return value;
}

export function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

export function calculateGrossYield(annualRent, purchasePrice) {
  assertNonNegative(annualRent, "年間家賃収入");
  assertPositive(purchasePrice, "物件購入価格");
  return (annualRent / purchasePrice) * 100;
}

export function calculateNetYield(annualRent, annualExpenses, purchasePrice, purchaseCosts) {
  assertNonNegative(annualRent, "年間家賃収入");
  assertNonNegative(annualExpenses, "年間諸経費");
  assertPositive(purchasePrice, "物件購入価格");
  assertNonNegative(purchaseCosts, "購入諸費用");
  const denominator = purchasePrice + purchaseCosts;
  assertPositive(denominator, "総投資額");
  return ((annualRent - annualExpenses) / denominator) * 100;
}

export function calculateNOI(annualRent, occupancyRatePct, operatingExpenses) {
  assertNonNegative(annualRent, "年間家賃収入");
  assertNonNegative(operatingExpenses, "運営費");
  if (occupancyRatePct < 0 || occupancyRatePct > 100) {
    throw new CalculationError("稼働率は0から100の範囲で入力してください", "稼働率");
  }
  return annualRent * (occupancyRatePct / 100) - operatingExpenses;
}

export function calculateMonthlyLoanPayment(principal, annualInterestRatePct, years) {
  assertNonNegative(principal, "借入金額");
  assertNonNegative(annualInterestRatePct, "金利");
  assertPositive(years, "返済期間");
  if (principal === 0) return 0;
  const payments = Math.round(years * 12);
  const monthlyRate = annualInterestRatePct / 100 / 12;
  if (monthlyRate === 0) {
    return principal / payments;
  }
  const factor = (1 + monthlyRate) ** payments;
  return principal * monthlyRate * factor / (factor - 1);
}

export function calculateCCR(annualCashFlow, equity) {
  assertPositive(equity, "自己資本投下額");
  return (annualCashFlow / equity) * 100;
}

export function calculateDCR(noi, annualLoanPayment) {
  assertNonNegative(noi, "NOI");
  assertNonNegative(annualLoanPayment, "年間ローン返済額");
  if (annualLoanPayment === 0) return Number.POSITIVE_INFINITY;
  return noi / annualLoanPayment;
}

export function calculateInvestmentMetrics(input) {
  const annualRent = assertNonNegative(input.monthlyRent, "月額家賃") * 12;
  const purchasePrice = assertPositive(input.purchasePrice, "物件購入価格");
  const purchaseCosts = assertNonNegative(input.purchaseCosts, "購入諸費用");
  const operatingExpenses = assertNonNegative(input.operatingExpenses, "年間運営費");
  const equity = assertPositive(input.equity, "自己資本");
  const monthlyLoanPayment = calculateMonthlyLoanPayment(
    input.loanPrincipal,
    input.annualInterestRatePct,
    input.loanYears
  );
  const annualLoanPayment = monthlyLoanPayment * 12;
  const noi = calculateNOI(annualRent, input.occupancyRatePct, operatingExpenses);
  const annualCashFlow = noi - annualLoanPayment;
  return {
    annualRent,
    grossYield: calculateGrossYield(annualRent, purchasePrice),
    netYield: calculateNetYield(annualRent, operatingExpenses, purchasePrice, purchaseCosts),
    noi,
    monthlyLoanPayment,
    annualLoanPayment,
    annualCashFlow,
    ccr: calculateCCR(annualCashFlow, equity),
    dcr: calculateDCR(noi, annualLoanPayment)
  };
}

export function buildInvestmentComment(metrics) {
  const notes = [];
  if (metrics.dcr < 1.0) notes.push("返済負担がNOIを上回っています");
  else if (metrics.dcr < 1.2) notes.push("DCRは要注意水準です");
  else notes.push("DCRは余裕を持った水準です");

  if (metrics.ccr >= 8) notes.push("CCRは高めです");
  else if (metrics.ccr >= 3) notes.push("CCRは標準的です");
  else notes.push("CCRは低めです");

  if (metrics.annualCashFlow < 0) notes.push("税引き前CFは赤字です");
  return notes.join(" / ");
}
