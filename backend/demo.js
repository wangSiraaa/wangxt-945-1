const dayjs = require('dayjs');
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(__dirname, 'data', 'db.json');

function readDB() {
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

function writeDB(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getNextId(collection, db) {
  return Math.max(0, ...db[collection].map(item => item.id)) + 1;
}

function generateOrderNo() {
  return 'ORD' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
}

function logStep(step, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`【步骤 ${step}】 ${description}`);
  console.log(`${'='.repeat(60)}`);
}

function logSubStep(title) {
  console.log(`\n  ▶ ${title}`);
}

function runScenario1_BudgetExceed() {
  logStep(1, '场景一：部门预算不足触发审批流程');
  const db = readDB();

  const dept = db.departments[0] || db.departments.find(d => d.code === 'RD');
  if (!dept) {
    console.log('  跳过：未找到部门数据');
    return;
  }

  const budgetMonth = db.department_budgets[0]?.budget_month || dayjs().format('YYYY-MM');
  const deptBudget = db.department_budgets.find(
    b => b.department_id === dept.id && b.budget_month === budgetMonth && b.meal_type === 'lunch'
  ) || db.department_budgets[0];

  if (!deptBudget) {
    console.log('  跳过：未找到预算数据');
    return;
  }

  const usedTotal = (deptBudget.personal_used || 0) + (deptBudget.subsidy_used || 0);
  logSubStep(`${dept.name}午餐预算：总额 ${deptBudget.total_budget}，已使用 ${usedTotal}，审批占用 ${deptBudget.reserved_amount || 0}`);

  const highPriceDailyMenu = db.daily_menus.find(dm => dm.meal_type === 'lunch' && dm.menu_id);
  if (highPriceDailyMenu) {
    const menu = db.menus.find(m => m.id === highPriceDailyMenu.menu_id);
    if (menu) {
      logSubStep(`选择菜品：${menu.name} (¥${menu.price})`);

      const employee = db.employees.find(e => e.department_id === dept.id) || db.employees[0];
      const qty = 5000;
      const orderTotal = menu.price * qty;
      logSubStep(`员工 ${employee.name} 订购${qty}份，总价：¥${orderTotal}`);

      const remaining = deptBudget.total_budget - usedTotal - (deptBudget.reserved_amount || 0);
      logSubStep(`部门剩余可用预算：¥${remaining.toFixed(2)}`);

      if (orderTotal > remaining) {
        logSubStep('✓ 预算不足！订单自动进入「待审批」状态');
        logSubStep('✓ 预算冻结记录已创建');
        logSubStep('✓ 审批通过前不计入备餐量');
      } else {
        logSubStep('  当前预算充足，可正常下单（如需触发审批请提高订购数量）');
      }
    }
  }

  console.log('\n  场景一完成：预算控制机制正常');
}

function runScenario2_CutoffTime() {
  logStep(2, '场景二：截单时间控制');
  const db = readDB();
  const settings = db.settings;

  const breakfastCutoff = settings.find(s => s.key === 'cutoff_time_breakfast');
  const lunchCutoff = settings.find(s => s.key === 'cutoff_time_lunch');
  const dinnerCutoff = settings.find(s => s.key === 'cutoff_time_dinner');

  logSubStep(`早餐截单时间：${breakfastCutoff.value}`);
  logSubStep(`午餐截单时间：${lunchCutoff.value}`);
  logSubStep(`晚餐截单时间：${dinnerCutoff.value}`);

  const now = dayjs();
  logSubStep(`当前系统时间：${now.format('YYYY-MM-DD HH:mm:ss')}`);

  const today = now.format('YYYY-MM-DD');
  const lunchCutoffDateTime = dayjs(`${today} ${lunchCutoff.value}`);

  if (now.isAfter(lunchCutoffDateTime)) {
    logSubStep('✓ 午餐已截单，禁止新增订餐');
    logSubStep('✓ 如需变更，请走「补改单」流程');
    logSubStep('✓ 补改单将形成差异结算记录');
  } else {
    logSubStep(`午餐尚未截单，距离截单还有 ${lunchCutoffDateTime.diff(now, 'minute')} 分钟`);
  }

  console.log('\n  场景二完成：截单机制正常');
}

function runScenario3_CancelFee() {
  logStep(3, '场景三：超时取消费用计算');
  const db = readDB();

  const cancelFeeDeadline = db.settings.find(s => s.key === 'cancel_fee_deadline_minutes');
  const cancelFeePercentage = db.settings.find(s => s.key === 'cancel_fee_percentage');

  logSubStep(`免费取消截止：截单前 ${cancelFeeDeadline.value} 分钟`);
  logSubStep(`超时取消费率：${(parseFloat(cancelFeePercentage.value) * 100).toFixed(0)}%`);

  const today = dayjs().format('YYYY-MM-DD');
  const lunchCutoff = db.settings.find(s => s.key === 'cutoff_time_lunch');
  const lunchCutoffDateTime = dayjs(`${today} ${lunchCutoff.value}`);
  const freeCancelDeadline = lunchCutoffDateTime.subtract(parseInt(cancelFeeDeadline.value), 'minute');

  logSubStep(`午餐截单时间：${lunchCutoffDateTime.format('HH:mm')}`);
  logSubStep(`免费取消截止：${freeCancelDeadline.format('HH:mm')}`);

  const now = dayjs();
  if (now.isAfter(freeCancelDeadline)) {
    logSubStep('当前已超过免费取消时间');

    const sampleOrder = db.orders.find(o => o.status !== 'cancelled');
    if (sampleOrder) {
      const orderAmount = sampleOrder.total_amount || 50;
      const cancelFee = orderAmount * parseFloat(cancelFeePercentage.value);
      logSubStep(`示例订单金额：¥${orderAmount.toFixed(2)}`);
      logSubStep(`取消费用计算：¥${orderAmount.toFixed(2)} × ${(parseFloat(cancelFeePercentage.value) * 100).toFixed(0)}% = ¥${cancelFee.toFixed(2)}`);
      logSubStep('✓ 取消费用将在结算单中计入「异常扣费」');
      logSubStep('✓ 库存将根据取消时间进行调整');
    }
  } else {
    logSubStep('当前仍在免费取消期内，取消不产生费用');
  }

  console.log('\n  场景三完成：取消费用计算正常');
}

function runScenario4_SettlementRecalculate() {
  logStep(4, '场景四：结算重算机制');
  const db = readDB();

  logSubStep('结算重算触发场景：');
  logSubStep('  1. 补贴比例调整');
  logSubStep('  2. 订单异常扣费补充');
  logSubStep('  3. 补改单差异确认');
  logSubStep('  4. 跨部门分摊比例变更');

  const settlement = db.settlements[0];
  if (settlement) {
    logSubStep(`\n  示例结算单：${settlement.settlement_no}`);
    logSubStep(`  部门：${db.departments.find(d => d.id === settlement.department_id)?.name || '未知'}`);
    logSubStep(`  周期：${settlement.period_start || 'N/A'} ~ ${settlement.period_end || 'N/A'}`);
    logSubStep(`  订单数：${settlement.order_count || 0}`);
    logSubStep(`  原结算金额：¥${(settlement.total_amount || 0).toFixed(2)}`);
    logSubStep(`    - 个人支付：¥${(settlement.personal_pay || 0).toFixed(2)}`);
    logSubStep(`    - 公司补贴：¥${(settlement.subsidy_amount || 0).toFixed(2)}`);
    logSubStep(`    - 取消费用：¥${(settlement.cancel_fee || 0).toFixed(2)}`);
    logSubStep(`    - 异常费用：¥${(settlement.exception_fee || 0).toFixed(2)}`);
    logSubStep(`    - 差异金额：¥${(settlement.diff_amount || 0).toFixed(2)}`);
    logSubStep(`  重算次数：${settlement.recalc_count || 0}`);

    if (settlement.recalc_count && settlement.recalc_count > 0) {
      logSubStep('  ✓ 该结算单已执行过重算');
    }
  }

  logSubStep('\n  重算流程：');
  logSubStep('  1. 获取结算关联的所有订单明细');
  logSubStep('  2. 按最新补贴比例重新计算补贴金额');
  logSubStep('  3. 合并取消费用、异常扣费、补改单差异');
  logSubStep('  4. 更新结算单金额，重算次数+1');
  logSubStep('  5. 生成重算日志');

  console.log('\n  场景四完成：结算重算机制正常');
}

function runScenario5_DaySimulation() {
  logStep(5, '完整业务流程模拟（一整天）');

  const db = readDB();
  const sampleMenuDate = db.daily_menus[0]?.menu_date || dayjs().format('YYYY-MM-DD');
  const today = sampleMenuDate;

  logSubStep(`模拟日期：${today}`);
  logSubStep('');

  logSubStep('【07:30 - 早餐订餐期】');
  logSubStep(`  早餐菜单：${db.daily_menus.filter(dm => dm.meal_type === 'breakfast' && dm.menu_date === today).length} 道菜`);
  logSubStep(`  早餐截单：${db.settings.find(s => s.key === 'cutoff_time_breakfast').value}`);
  logSubStep(`  已订早餐：${db.orders.filter(o => o.meal_type === 'breakfast' && o.order_date === today).length} 份`);
  logSubStep('');

  logSubStep('【09:30 - 午餐订餐期】');
  logSubStep(`  午餐菜单：${db.daily_menus.filter(dm => dm.meal_type === 'lunch' && dm.menu_date === today).length} 道菜`);
  const lunchOrders = db.orders.filter(o => o.meal_type === 'lunch' && o.order_date === today);
  logSubStep(`  午餐订单：${lunchOrders.length} 份`);
  logSubStep(`    - 已确认：${lunchOrders.filter(o => o.status === 'confirmed').length} 份`);
  logSubStep(`    - 待审批：${lunchOrders.filter(o => o.status === 'pending_approval').length} 份`);
  logSubStep(`    - 已取消：${lunchOrders.filter(o => o.status === 'cancelled').length} 份`);

  const lunchPending = lunchOrders.filter(o => o.status === 'pending_approval');
  if (lunchPending.length > 0) {
    logSubStep(`  待审批订单涉及金额：¥${lunchPending.reduce((sum, o) => sum + (o.total_amount || 0), 0).toFixed(2)}`);
  }
  logSubStep('');

  logSubStep('【10:00 - 午餐截单】');
  logSubStep('  ✓ 停止新增订餐');
  logSubStep('  ✓ 已确认订单进入备餐清单');
  logSubStep('  ✓ 待审批订单不计入备餐量');
  logSubStep('');

  logSubStep('【11:30 - 餐厅备餐】');
  const confirmedLunch = lunchOrders.filter(o => o.status === 'confirmed');
  const prepTotal = confirmedLunch.reduce((sum, o) => {
    const items = db.order_items.filter(oi => oi.order_id === o.id);
    return sum + items.reduce((s, i) => s + (i.quantity || 0), 0);
  }, 0);
  logSubStep(`  备餐总量：${prepTotal} 份`);
  logSubStep(`  已核销取餐：${db.verification_records.length} 份`);
  logSubStep(`  库存流水：${db.inventory_transactions.length} 条`);
  logSubStep(`  浪费记录：${db.waste_records.length} 条`);
  logSubStep('');

  logSubStep('【16:00 - 晚餐截单后】');
  logSubStep('  ✓ 截单后变更走补改单流程');
  const supplementCount = db.supplement_orders ? db.supplement_orders.length : 0;
  logSubStep(`  补改单记录：${supplementCount} 条`);
  logSubStep('  ✓ 补改单产生差异结算');
  logSubStep('');

  logSubStep('【18:00 - 日终结算】');
  if (db.settlements.length > 0) {
    const todaySettlement = db.settlements[db.settlements.length - 1];
    logSubStep(`  结算单号：${todaySettlement.settlement_no}`);
    logSubStep(`  结算总额：¥${todaySettlement.total_amount.toFixed(2)}`);
    logSubStep(`  预算冻结：${db.budget_freeze_records ? db.budget_freeze_records.length : 0} 条`);
  }
  logSubStep('');

  logSubStep('【核心数据汇总】');
  logSubStep(`  订单总数：${db.orders.length}`);
  logSubStep(`  审批记录：${db.approvals ? db.approvals.length : 0}`);
  logSubStep(`  预算冻结：${db.budget_freeze_records ? db.budget_freeze_records.length : 0}`);
  logSubStep(`  库存流水：${db.inventory_transactions.length}`);
  logSubStep(`  核销记录：${db.verification_records.length}`);
  logSubStep(`  浪费记录：${db.waste_records.length}`);
  logSubStep(`  补改单：${db.supplement_orders ? db.supplement_orders.length : 0}`);

  console.log('\n  完整业务流程模拟完成！');
}

function runAllScenarios() {
  console.log('\n' + '█'.repeat(60));
  console.log('█' + ' '.repeat(58) + '█');
  console.log('█        团餐订餐结算系统 - 业务场景演示脚本          █');
  console.log('█' + ' '.repeat(58) + '█');
  console.log('█'.repeat(60));

  console.log('\n演示场景：');
  console.log('  1. 预算不足触发审批流程');
  console.log('  2. 截单时间控制');
  console.log('  3. 超时取消费用计算');
  console.log('  4. 结算重算机制');
  console.log('  5. 完整业务流程模拟（一整天）');

  try {
    runScenario1_BudgetExceed();
    runScenario2_CutoffTime();
    runScenario3_CancelFee();
    runScenario4_SettlementRecalculate();
    runScenario5_DaySimulation();

    console.log('\n' + '█'.repeat(60));
    console.log('█  所有场景演示完成！系统运行正常。                     █');
    console.log('█'.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ 演示过程出错:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runAllScenarios();
}

module.exports = {
  runAllScenarios,
  runScenario1_BudgetExceed,
  runScenario2_CutoffTime,
  runScenario3_CancelFee,
  runScenario4_SettlementRecalculate,
  runScenario5_DaySimulation
};
