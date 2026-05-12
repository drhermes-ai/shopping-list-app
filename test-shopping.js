const { chromium } = require('playwright');
const path = require('path');

const FILE_URL = 'file://' + path.resolve(__dirname, 'shopping-list.html');

let passed = 0;
let failed = 0;
const results = [];

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    results.push({ status: '✅ PASS', label, detail });
    console.log(`  ✅ PASS  ${label}`);
  } else {
    failed++;
    results.push({ status: '❌ FAIL', label, detail });
    console.log(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(FILE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  console.log('\n══════════════════════════════════════════');
  console.log('  🛒 쇼핑 리스트 앱 자동 테스트');
  console.log('══════════════════════════════════════════\n');

  console.log('📋 [1] 초기 상태 확인');
  const emptyMsg = await page.locator('.empty').textContent().catch(() => null);
  assert('빈 목록 안내 문구 표시', emptyMsg?.includes('아이템을 추가해 보세요'));
  const summaryInit = await page.locator('#summary').textContent();
  assert('헤더 요약: "항목이 없습니다" 표시', summaryInit.includes('항목이 없습니다'));
  const clearDisabled = await page.locator('#btnClear').isDisabled();
  assert('"완료 항목 삭제" 버튼 비활성화 (초기)', clearDisabled);

  console.log('\n➕ [2] 아이템 추가 (Enter 키)');
  await page.locator('#input').fill('사과');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const items1 = await page.locator('.item').count();
  assert('Enter로 아이템 추가됨 (1개)', items1 === 1);
  const firstText = await page.locator('.item-text').first().textContent();
  assert('추가된 아이템 텍스트 "사과" 확인', firstText.trim() === '사과');
  const inputCleared = await page.locator('#input').inputValue();
  assert('추가 후 입력창 자동 비워짐', inputCleared === '');

  console.log('\n➕ [3] 아이템 추가 (+ 버튼)');
  await page.locator('#input').fill('우유');
  await page.locator('#btnAdd').click();
  await page.waitForTimeout(100);
  await page.locator('#input').fill('달걀');
  await page.locator('#btnAdd').click();
  await page.waitForTimeout(100);
  const items3 = await page.locator('.item').count();
  assert('버튼으로 아이템 2개 추가 → 총 3개', items3 === 3);

  console.log('\n🚫 [4] 빈 입력 방지');
  await page.locator('#input').fill('   ');
  await page.locator('#btnAdd').click();
  await page.waitForTimeout(100);
  const itemsAfterEmpty = await page.locator('.item').count();
  assert('공백 입력 시 아이템 추가 안 됨', itemsAfterEmpty === 3);

  console.log('\n📊 [5] 헤더 요약 업데이트');
  const summary3 = await page.locator('#summary').textContent();
  assert('헤더: "총 3개 · 완료 0개" 표시', summary3.includes('총 3개') && summary3.includes('완료 0개'));
  const footerInfo = await page.locator('#footerInfo').textContent();
  assert('하단: "3개 남음" 표시', footerInfo.includes('3개 남음'));

  console.log('\n✔️  [6] 체크(완료) 기능');
  await page.locator('.item-check').first().click();
  await page.waitForTimeout(100);
  const checkedCount1 = await page.locator('.item.checked').count();
  assert('체크 클릭 → .checked 클래스 부여', checkedCount1 === 1);
  const checkedText = await page.locator('.item.checked .item-text').first().textContent();
  assert('체크된 아이템 텍스트에 취소선 스타일 적용', checkedText !== null);
  const summary6 = await page.locator('#summary').textContent();
  assert('헤더: "완료 1개" 반영', summary6.includes('완료 1개'));
  const footerAfterCheck = await page.locator('#footerInfo').textContent();
  assert('하단: "2개 남음" 반영', footerAfterCheck.includes('2개 남음'));

  console.log('\n🔄 [7] 체크 해제 (토글)');
  await page.locator('.item-check').first().click();
  await page.waitForTimeout(100);
  const checkedAfterToggle = await page.locator('.item.checked').count();
  assert('재클릭으로 체크 해제됨', checkedAfterToggle === 0);
  const summary7 = await page.locator('#summary').textContent();
  assert('헤더: "완료 0개" 로 복원', summary7.includes('완료 0개'));

  console.log('\n🗑️  [8] 아이템 삭제');
  const beforeDelete = await page.locator('.item').count();
  await page.locator('.btn-delete').first().click();
  await page.waitForTimeout(100);
  const afterDelete = await page.locator('.item').count();
  assert('삭제 버튼 클릭 → 1개 감소', afterDelete === beforeDelete - 1);
  const summary8 = await page.locator('#summary').textContent();
  assert('헤더 요약이 삭제 후 갱신됨', summary8.includes('총 2개'));

  console.log('\n🧹 [9] 완료 항목 일괄 삭제');
  await page.locator('.item-check').first().click();
  await page.waitForTimeout(100);
  const clearEnabled = await page.locator('#btnClear').isEnabled();
  assert('"완료 항목 삭제" 버튼 활성화됨', clearEnabled);
  await page.locator('#btnClear').click();
  await page.waitForTimeout(100);
  const afterClear = await page.locator('.item').count();
  assert('완료 항목 삭제 후 1개만 남음', afterClear === 1);
  const clearDisabledAgain = await page.locator('#btnClear').isDisabled();
  assert('삭제 후 버튼 다시 비활성화', clearDisabledAgain);

  console.log('\n💾 [10] localStorage 저장 확인');
  const stored = await page.evaluate(() => localStorage.getItem('shopping'));
  const parsed = JSON.parse(stored);
  assert('localStorage에 아이템이 저장됨', Array.isArray(parsed) && parsed.length > 0);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const afterReload = await page.locator('.item').count();
  assert('새로고침 후에도 목록 유지', afterReload === 1);

  console.log('\n🔚 [11] 마지막 아이템 삭제 → 빈 상태 복원');
  await page.locator('.btn-delete').first().click();
  await page.waitForTimeout(100);
  const emptyAgain = await page.locator('.empty').textContent().catch(() => null);
  assert('빈 안내 문구 다시 표시', emptyAgain?.includes('아이템을 추가해 보세요'));
  const summaryEmpty = await page.locator('#summary').textContent();
  assert('헤더: "항목이 없습니다" 복원', summaryEmpty.includes('항목이 없습니다'));

  console.log('\n══════════════════════════════════════════');
  console.log(`  결과: ${passed} 통과 / ${failed} 실패 / 총 ${passed + failed}개`);
  if (failed === 0) {
    console.log('  🎉 모든 테스트를 통과했습니다!');
  } else {
    console.log('  ⚠️  일부 테스트가 실패했습니다. 위 항목을 확인하세요.');
  }
  console.log('══════════════════════════════════════════\n');

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();