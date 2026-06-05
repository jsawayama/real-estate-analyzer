import test from "node:test";
import assert from "node:assert/strict";
import {
  CalculationError,
  calculateDCR,
  calculateGrossYield,
  calculateInvestmentMetrics,
  calculateMonthlyLoanPayment,
  calculateNetYield,
  calculateNOI,
  round
} from "../src/calculations.mjs";

test("表面利回り: 年間家賃120万円、物件価格2000万円は6.0%", () => {
  assert.equal(round(calculateGrossYield(1_200_000, 20_000_000), 2), 6);
});

test("表面利回り: 年間家賃60万円、物件価格3000万円は2.0%", () => {
  assert.equal(round(calculateGrossYield(600_000, 30_000_000), 2), 2);
});

test("表面利回り: 物件価格0は除算エラー", () => {
  assert.throws(() => calculateGrossYield(600_000, 0), CalculationError);
});

test("表面利回り: 家賃0は0%を返す", () => {
  assert.equal(calculateGrossYield(0, 30_000_000), 0);
});

test("実質利回り: 指定ケースは4.36%", () => {
  const result = calculateNetYield(1_200_000, 240_000, 20_000_000, 2_000_000);
  assert.equal(round(result, 2), 4.36);
});

test("実質利回り: 購入諸費用0でも計算する", () => {
  const result = calculateNetYield(1_200_000, 240_000, 20_000_000, 0);
  assert.equal(round(result, 2), 4.8);
});

test("ローン返済: 金利0%は元本を返済回数で割る", () => {
  const monthly = calculateMonthlyLoanPayment(12_000_000, 0, 10);
  assert.equal(monthly, 100_000);
});

test("ローン返済: 返済期間1年の境界値", () => {
  const monthly = calculateMonthlyLoanPayment(1_200_000, 1.2, 1);
  assert.ok(monthly > 100_000);
  assert.ok(monthly < 101_000);
});

test("DCR: 1.0未満の債務超過状態を表現できる", () => {
  assert.equal(round(calculateDCR(900_000, 1_200_000), 2), 0.75);
});

test("標準的なワンルーム投資ケースを検証する", () => {
  const metrics = calculateInvestmentMetrics({
    purchasePrice: 18_000_000,
    purchaseCosts: 900_000,
    equity: 4_500_000,
    loanPrincipal: 14_400_000,
    annualInterestRatePct: 1.8,
    loanYears: 35,
    monthlyRent: 80_000,
    occupancyRatePct: 95,
    operatingExpenses: 144_000
  });

  assert.equal(round(metrics.grossYield, 2), 5.33);
  assert.equal(round(metrics.netYield, 2), 4.32);
  assert.equal(round(metrics.noi / 10_000, 1), 76.8);
  assert.equal(round(metrics.monthlyLoanPayment / 1000, 1), 46.2);
  assert.equal(round(metrics.dcr, 2), 1.38);
});

test("高金利・短期ローンケースを算出できる", () => {
  const metrics = calculateInvestmentMetrics({
    purchasePrice: 50_000_000,
    purchaseCosts: 2_500_000,
    equity: 10_000_000,
    loanPrincipal: 40_000_000,
    annualInterestRatePct: 3.5,
    loanYears: 20,
    monthlyRent: 250_000,
    occupancyRatePct: 90,
    operatingExpenses: 600_000
  });

  assert.equal(round(metrics.grossYield, 2), 6);
  assert.equal(round(metrics.noi / 10_000, 0), 210);
  assert.ok(metrics.annualCashFlow < 0);
  assert.ok(metrics.dcr < 1);
});

test("NOI: 稼働率範囲外はエラー", () => {
  assert.throws(() => calculateNOI(1_000_000, 120, 100_000), CalculationError);
});
