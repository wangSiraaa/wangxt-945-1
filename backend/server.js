const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dayjs = require('dayjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const DATA_FILE = path.join(__dirname, 'data', 'db.json');

function readDB() {
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data);
}

function writeDB(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getNextId(collection) {
  const db = readDB();
  return Math.max(0, ...db[collection].map(item => item.id)) + 1;
}

function generateOrderNo() {
  return 'ORD' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
}

function generateSettlementNo() {
  return 'SET' + dayjs().format('YYYYMMDDHHmm') + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

function getSetting(key, defaultValue = null) {
  const db = readDB();
  const setting = db.settings.find(s => s.key === key);
  return setting ? setting.value : defaultValue;
}

function isBeforeCutoff(menuDate, mealType, isExtra = false) {
  if (isExtra) return true;
  const now = dayjs();
  let cutoffKey, defaultCutoff;
  if (mealType === 'breakfast') {
    cutoffKey = 'cutoff_time_breakfast';
    defaultCutoff = '07:30';
  } else if (mealType === 'lunch') {
    cutoffKey = 'cutoff_time_lunch';
    defaultCutoff = '10:00';
  } else {
    cutoffKey = 'cutoff_time_dinner';
    defaultCutoff = '16:00';
  }
  const cutoffTime = getSetting(cutoffKey, defaultCutoff);
  const [cutoffHour, cutoffMinute] = cutoffTime.split(':').map(Number);
  
  const cutoffDateTime = dayjs(menuDate).hour(cutoffHour).minute(cutoffMinute).second(0);
  return now.isBefore(cutoffDateTime);
}

function getCancelFeeDeadlineMinutes() {
  return parseInt(getSetting('cancel_fee_deadline_minutes', '60'));
}

function getCancelFeePercentage() {
  return parseFloat(getSetting('cancel_fee_percentage', '0.5'));
}

function isWithinFreeCancelPeriod(menuDate, mealType) {
  const now = dayjs();
  const deadlineMinutes = getCancelFeeDeadlineMinutes();
  let cutoffKey, defaultCutoff;
  if (mealType === 'breakfast') {
    cutoffKey = 'cutoff_time_breakfast';
    defaultCutoff = '07:30';
  } else if (mealType === 'lunch') {
    cutoffKey = 'cutoff_time_lunch';
    defaultCutoff = '10:00';
  } else {
    cutoffKey = 'cutoff_time_dinner';
    defaultCutoff = '16:00';
  }
  const cutoffTime = getSetting(cutoffKey, defaultCutoff);
  const [cutoffHour, cutoffMinute] = cutoffTime.split(':').map(Number);
  
  const cutoffDateTime = dayjs(menuDate).hour(cutoffHour).minute(cutoffMinute).second(0);
  const freeCancelDeadline = cutoffDateTime.subtract(deadlineMinutes, 'minute');
  
  return now.isBefore(freeCancelDeadline);
}

function getDepartmentBudget(departmentId, budgetMonth) {
  const db = readDB();
  let budget = db.department_budgets.find(b => b.department_id === departmentId && b.budget_month === budgetMonth);
  
  if (!budget) {
    const dept = db.departments.find(d => d.id === departmentId);
    budget = {
      department_id: departmentId,
      budget_month: budgetMonth,
      total_budget: dept ? dept.monthly_budget : 0,
      used_amount: 0,
      reserved_amount: 0
    };
  }
  
  return budget;
}

function checkBudgetAvailable(departmentId, menuDate, amount) {
  const budgetMonth = dayjs(menuDate).format('YYYY-MM');
  const budget = getDepartmentBudget(departmentId, budgetMonth);
  const remaining = budget.total_budget - budget.used_amount - budget.reserved_amount;
  return {
    available: remaining >= amount,
    remaining,
    totalBudget: budget.total_budget,
    usedAmount: budget.used_amount,
    reservedAmount: budget.reserved_amount
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/departments', (req, res) => {
  const db = readDB();
  res.json(db.departments);
});

app.get('/api/employees', (req, res) => {
  const db = readDB();
  const { department_id } = req.query;
  let employees = db.employees;
  if (department_id) {
    employees = employees.filter(e => e.department_id === parseInt(department_id));
  }
  res.json(employees);
});

app.get('/api/menus', (req, res) => {
  const db = readDB();
  res.json(db.menus.filter(m => m.is_active === 1));
});

app.get('/api/daily-menus', (req, res) => {
  const db = readDB();
  const { date, meal_type, canteen_id } = req.query;
  let dailyMenus = db.daily_menus;
  
  if (date) {
    dailyMenus = dailyMenus.filter(dm => dm.menu_date === date);
  }
  if (meal_type) {
    dailyMenus = dailyMenus.filter(dm => dm.meal_type === meal_type);
  }
  if (canteen_id) {
    const cid = parseInt(canteen_id);
    dailyMenus = dailyMenus.filter(dm => dm.canteen_id === cid);
  }
  
  const result = dailyMenus.map(dm => {
    const menu = db.menus.find(m => m.id === dm.menu_id);
    return {
      ...dm,
      menu: menu
    };
  });
  
  res.json(result);
});

app.get('/api/orders', (req, res) => {
  const db = readDB();
  const { employee_id, department_id, menu_date, status, meal_type, canteen_id } = req.query;
  let orders = db.orders;
  
  if (employee_id) {
    orders = orders.filter(o => o.employee_id === parseInt(employee_id));
  }
  if (department_id) {
    orders = orders.filter(o => o.department_id === parseInt(department_id));
  }
  if (menu_date) {
    orders = orders.filter(o => o.menu_date === menu_date);
  }
  if (status) {
    orders = orders.filter(o => o.status === status);
  }
  if (meal_type) {
    orders = orders.filter(o => o.meal_type === meal_type);
  }
  if (canteen_id) {
    const cid = parseInt(canteen_id);
    orders = orders.filter(o => o.canteen_id === cid);
  }
  
  orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const result = orders.map(order => {
    const employee = db.employees.find(e => e.id === order.employee_id);
    const department = db.departments.find(d => d.id === order.department_id);
    const items = db.order_items.filter(i => i.order_id === order.id);
    return {
      ...order,
      employee_name: employee ? employee.name : '',
      employee_no: employee ? employee.employee_no : '',
      department_name: department ? department.name : '',
      items
    };
  });
  
  res.json(result);
});

app.get('/api/orders/:id', (req, res) => {
  const db = readDB();
  const order = db.orders.find(o => o.id === parseInt(req.params.id));
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  const employee = db.employees.find(e => e.id === order.employee_id);
  const department = db.departments.find(d => d.id === order.department_id);
  const canteen = db.canteens.find(c => c.id === order.canteen_id);
  const items = db.order_items.filter(i => i.order_id === order.id);
  
  res.json({
    ...order,
    employee_name: employee ? employee.name : '',
    employee_no: employee ? employee.employee_no : '',
    department_name: department ? department.name : '',
    canteen_name: canteen ? canteen.name : '',
    items
  });
});

app.post('/api/orders', (req, res) => {
  const db = readDB();
  const { employee_id, menu_date, meal_type, items, canteen_id, is_extra } = req.body;
  
  const employee = db.employees.find(e => e.id === employee_id);
  if (!employee) {
    return res.status(400).json({ error: '员工不存在' });
  }

  const canteenId = parseInt(canteen_id);
  if (!canteenId) {
    return res.status(400).json({ error: '请选择食堂' });
  }
  const canteen = db.canteens.find(c => c.id === canteenId);
  if (!canteen) {
    return res.status(400).json({ error: '食堂不存在' });
  }
  
  if (!items || items.length === 0) {
    return res.status(400).json({ error: '请选择餐品' });
  }
  
  const isExtra = is_extra === 1 || is_extra === true;
  
  let totalAmount = 0;
  const orderItems = [];
  
  for (const item of items) {
    const dailyMenu = db.daily_menus.find(dm => dm.id === item.daily_menu_id);
    if (!dailyMenu) {
      return res.status(400).json({ error: '餐品不存在' });
    }
    const menu = db.menus.find(m => m.id === dailyMenu.menu_id);
    if (!menu) {
      return res.status(400).json({ error: '餐品数据异常' });
    }
    if (dailyMenu.canteen_id !== canteenId) {
      return res.status(400).json({ error: `${menu.name}不属于当前所选食堂` });
    }
    if (dailyMenu.stock < item.quantity) {
      return res.status(400).json({ error: `${menu.name}库存不足` });
    }
    const subtotal = menu.price * item.quantity;
    totalAmount += subtotal;
    orderItems.push({
      daily_menu_id: dailyMenu.id,
      menu_id: dailyMenu.menu_id,
      canteen_id: canteenId,
      menu_name: menu.name,
      price: menu.price,
      quantity: item.quantity,
      subtotal
    });
  }
  
  if (!isBeforeCutoff(menu_date, meal_type, isExtra)) {
    return res.status(400).json({ error: '已过截单时间，无法订餐' });
  }
  
  const budgetCheck = checkBudgetAvailable(employee.department_id, menu_date, totalAmount);
  const needsApproval = !budgetCheck.available;
  
  const orderId = getNextId('orders');
  const orderNo = generateOrderNo();
  const now = new Date().toISOString();
  
  const newOrder = {
    id: orderId,
    order_no: orderNo,
    employee_id,
    department_id: employee.department_id,
    canteen_id: canteenId,
    menu_date,
    meal_type,
    total_amount: totalAmount,
    status: needsApproval ? 'pending_approval' : 'confirmed',
    cancel_fee: 0,
    is_cancelled: 0,
    is_extra: isExtra ? 1 : 0,
    cancelled_at: null,
    approved_by: null,
    approved_at: null,
    reject_reason: null,
    created_at: now,
    updated_at: now
  };
  
  const orderItemsWithId = orderItems.map((item, idx) => ({
    id: db.order_items.length + idx + 1,
    order_id: orderId,
    ...item,
    created_at: now
  }));
  
  if (!needsApproval) {
    for (const item of items) {
      const dailyMenu = db.daily_menus.find(dm => dm.id === item.daily_menu_id);
      dailyMenu.stock -= item.quantity;
    }
    
    const budgetMonth = dayjs(menu_date).format('YYYY-MM');
    let budget = db.department_budgets.find(b => b.department_id === employee.department_id && b.budget_month === budgetMonth);
    if (!budget) {
      budget = {
        id: db.department_budgets.length + 1,
        department_id: employee.department_id,
        budget_month: budgetMonth,
        total_budget: db.departments.find(d => d.id === employee.department_id).monthly_budget,
        used_amount: 0,
        reserved_amount: 0,
        created_at: now,
        updated_at: now
      };
      db.department_budgets.push(budget);
    }
    budget.used_amount += totalAmount;
    budget.updated_at = now;
  } else {
    const budgetMonth = dayjs(menu_date).format('YYYY-MM');
    let budget = db.department_budgets.find(b => b.department_id === employee.department_id && b.budget_month === budgetMonth);
    if (!budget) {
      budget = {
        id: db.department_budgets.length + 1,
        department_id: employee.department_id,
        budget_month: budgetMonth,
        total_budget: db.departments.find(d => d.id === employee.department_id).monthly_budget,
        used_amount: 0,
        reserved_amount: 0,
        created_at: now,
        updated_at: now
      };
      db.department_budgets.push(budget);
    }
    budget.reserved_amount += totalAmount;
    budget.updated_at = now;
    
    const approvalId = db.approvals.length + 1;
    const newApproval = {
      id: approvalId,
      order_id: orderId,
      order_no: orderNo,
      department_id: employee.department_id,
      employee_id,
      amount: totalAmount,
      reason: '预算不足，需审批',
      status: 'pending',
      approved_by: null,
      approved_at: null,
      reject_reason: null,
      created_at: now
    };
    db.approvals.push(newApproval);
  }
  
  db.orders.push(newOrder);
  db.order_items.push(...orderItemsWithId);

  if (!needsApproval) {
    writeOrderChangeLog(db, {
      order_id: orderId, order_no: orderNo, change_type: 'create',
      before_status: '', after_status: 'confirmed',
      amount_diff: totalAmount, operator_id: employee_id,
      reason: isExtra ? '临时加餐' : '常规订餐',
      is_before_cutoff: isBeforeCutoff(menu_date, meal_type, isExtra)
    });
    writeFinanceLedgerForOrder(db, newOrder, 'create', null);
  } else {
    writeOrderChangeLog(db, {
      order_id: orderId, order_no: orderNo, change_type: 'create_pending',
      before_status: '', after_status: 'pending_approval',
      amount_diff: totalAmount, operator_id: employee_id,
      reason: '预算不足待审批',
      is_before_cutoff: isBeforeCutoff(menu_date, meal_type, isExtra)
    });
  }

  writeDB(db);
  
  const result = {
    ...newOrder,
    employee_name: employee.name,
    employee_no: employee.employee_no,
    department_name: db.departments.find(d => d.id === employee.department_id).name,
    items: orderItemsWithId,
    needs_approval: needsApproval,
    budget_check: budgetCheck
  };
  
  res.status(201).json(result);
});

app.post('/api/orders/:id/cancel', (req, res) => {
  const db = readDB();
  const order = db.orders.find(o => o.id === parseInt(req.params.id));
  
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  if (order.is_cancelled === 1) {
    return res.status(400).json({ error: '订单已取消' });
  }

  if (order.verified === 1) {
    return res.status(400).json({ error: '已核销取餐的订单不能取消' });
  }
  
  if (order.status === 'pending_approval') {
    order.is_cancelled = 1;
    order.status = 'cancelled';
    order.cancelled_at = new Date().toISOString();
    order.updated_at = order.cancelled_at;
    
    const approval = db.approvals.find(a => a.order_id === order.id && a.status === 'pending');
    if (approval) {
      approval.status = 'cancelled';
      approval.approved_at = order.cancelled_at;
    }
    
    const budgetMonth = dayjs(order.menu_date).format('YYYY-MM');
    const budget = db.department_budgets.find(b => b.department_id === order.department_id && b.budget_month === budgetMonth);
    if (budget) {
      budget.reserved_amount -= order.total_amount;
      budget.updated_at = order.cancelled_at;
    }
    
    writeOrderChangeLog(db, {
      order_id: order.id, order_no: order.order_no, change_type: 'cancel_pending',
      before_status: 'pending_approval', after_status: 'cancelled',
      amount_diff: -order.total_amount, operator_id: order.employee_id,
      reason: '取消待审批订单',
      is_before_cutoff: 1
    });

    writeDB(db);
    return res.json({ ...order, cancel_fee: 0 });
  }
  
  const freeCancel = isWithinFreeCancelPeriod(order.menu_date, order.meal_type);
  const cancelFee = freeCancel ? 0 : order.total_amount * getCancelFeePercentage();
  
  const items = db.order_items.filter(i => i.order_id === order.id);
  for (const item of items) {
    const dailyMenu = db.daily_menus.find(dm => dm.id === item.daily_menu_id);
    if (dailyMenu) {
      dailyMenu.stock += item.quantity;
    }
  }
  
  const budgetMonth = dayjs(order.menu_date).format('YYYY-MM');
  const budget = db.department_budgets.find(b => b.department_id === order.department_id && b.budget_month === budgetMonth);
  if (budget) {
    budget.used_amount -= order.total_amount;
    budget.used_amount += cancelFee;
    budget.updated_at = new Date().toISOString();
  }
  
  order.is_cancelled = 1;
  order.status = 'cancelled';
  order.cancel_fee = cancelFee;
  order.cancelled_at = new Date().toISOString();
  order.updated_at = order.cancelled_at;

  writeOrderChangeLog(db, {
    order_id: order.id, order_no: order.order_no, change_type: 'cancel',
    before_status: 'confirmed', after_status: 'cancelled',
    amount_diff: -order.total_amount + cancelFee, operator_id: order.employee_id,
    reason: freeCancel ? '截单前免费取消' : '截单后扣费取消',
    is_before_cutoff: freeCancel ? 1 : 0
  });
  order.cancel_fee = cancelFee;
  writeFinanceLedgerForOrder(db, order, 'cancel', null);
  
  writeDB(db);
  
  res.json({
    ...order,
    cancel_fee: cancelFee,
    free_cancel: freeCancel
  });
});

app.get('/api/approvals', (req, res) => {
  const db = readDB();
  const { status, department_id } = req.query;
  let approvals = [...db.approvals];
  
  if (status) {
    approvals = approvals.filter(a => a.status === status);
  }
  if (department_id) {
    approvals = approvals.filter(a => a.department_id === parseInt(department_id));
  }
  
  approvals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const result = approvals.map(approval => {
    const employee = db.employees.find(e => e.id === approval.employee_id);
    const department = db.departments.find(d => d.id === approval.department_id);
    const order = db.orders.find(o => o.id === approval.order_id);
    return {
      ...approval,
      employee_name: employee ? employee.name : '',
      department_name: department ? department.name : '',
      order: order
    };
  });
  
  res.json(result);
});

app.post('/api/approvals/:id/approve', (req, res) => {
  const db = readDB();
  const { approved_by } = req.body;
  const approval = db.approvals.find(a => a.id === parseInt(req.params.id));
  
  if (!approval) {
    return res.status(404).json({ error: '审批单不存在' });
  }
  
  if (approval.status !== 'pending') {
    return res.status(400).json({ error: '审批单已处理' });
  }
  
  const order = db.orders.find(o => o.id === approval.order_id);
  if (!order) {
    return res.status(400).json({ error: '关联订单不存在' });
  }
  
  const items = db.order_items.filter(i => i.order_id === order.id);
  for (const item of items) {
    const dailyMenu = db.daily_menus.find(dm => dm.id === item.daily_menu_id);
    if (dailyMenu) {
      dailyMenu.stock -= item.quantity;
    }
  }
  
  const budgetMonth = dayjs(order.menu_date).format('YYYY-MM');
  const budget = db.department_budgets.find(b => b.department_id === order.department_id && b.budget_month === budgetMonth);
  if (budget) {
    budget.reserved_amount -= order.total_amount;
    budget.used_amount += order.total_amount;
    budget.updated_at = new Date().toISOString();
  }
  
  const now = new Date().toISOString();
  approval.status = 'approved';
  approval.approved_by = approved_by || 1;
  approval.approved_at = now;
  
  order.status = 'confirmed';
  order.approved_by = approved_by || 1;
  order.approved_at = now;
  order.updated_at = now;

  writeOrderChangeLog(db, {
    order_id: order.id, order_no: order.order_no, change_type: 'approve',
    before_status: 'pending_approval', after_status: 'confirmed',
    amount_diff: order.total_amount, operator_id: approved_by || 1,
    reason: '审批通过，占用备餐库存',
    is_before_cutoff: isBeforeCutoff(order.menu_date, order.meal_type, order.is_extra === 1)
  });
  writeFinanceLedgerForOrder(db, order, 'approve', null);
  
  writeDB(db);
  
  res.json({ approval, order });
});

app.post('/api/approvals/:id/reject', (req, res) => {
  const db = readDB();
  const { reject_reason, approved_by } = req.body;
  const approval = db.approvals.find(a => a.id === parseInt(req.params.id));
  
  if (!approval) {
    return res.status(404).json({ error: '审批单不存在' });
  }
  
  if (approval.status !== 'pending') {
    return res.status(400).json({ error: '审批单已处理' });
  }
  
  const order = db.orders.find(o => o.id === approval.order_id);
  
  const budgetMonth = dayjs(order.menu_date).format('YYYY-MM');
  const budget = db.department_budgets.find(b => b.department_id === order.department_id && b.budget_month === budgetMonth);
  if (budget) {
    budget.reserved_amount -= order.total_amount;
    budget.updated_at = new Date().toISOString();
  }
  
  const now = new Date().toISOString();
  approval.status = 'rejected';
  approval.approved_by = approved_by || 1;
  approval.approved_at = now;
  approval.reject_reason = reject_reason || '审批不通过';
  
  order.status = 'rejected';
  order.is_cancelled = 1;
  order.reject_reason = reject_reason || '审批不通过';
  order.updated_at = now;
  
  writeDB(db);
  
  res.json({ approval, order });
});

app.get('/api/prep-list', (req, res) => {
  const db = readDB();
  const { date, meal_type } = req.query;
  
  let orders = db.orders.filter(o => o.status === 'confirmed' && o.is_cancelled === 0);
  
  if (date) {
    orders = orders.filter(o => o.menu_date === date);
  }
  if (meal_type) {
    orders = orders.filter(o => o.meal_type === meal_type);
  }
  
  const prepMap = {};
  
  for (const order of orders) {
    const items = db.order_items.filter(i => i.order_id === order.id);
    for (const item of items) {
      const key = `${item.menu_id}_${order.meal_type}`;
      if (!prepMap[key]) {
        prepMap[key] = {
          menu_id: item.menu_id,
          menu_name: item.menu_name,
          meal_type: order.meal_type,
          quantity: 0,
          order_count: 0,
          price: item.price
        };
      }
      prepMap[key].quantity += item.quantity;
    }
    const orderCountKey = Object.keys(prepMap).find(k => prepMap[k].menu_id === items[0]?.menu_id && prepMap[k].meal_type === order.meal_type);
    if (orderCountKey) {
      prepMap[orderCountKey].order_count++;
    }
  }
  
  const result = Object.values(prepMap).sort((a, b) => b.quantity - a.quantity);
  
  const deptSummary = {};
  for (const order of orders) {
    const dept = db.departments.find(d => d.id === order.department_id);
    if (!deptSummary[order.department_id]) {
      deptSummary[order.department_id] = {
        department_id: order.department_id,
        department_name: dept ? dept.name : '',
        order_count: 0,
        total_amount: 0
      };
    }
    deptSummary[order.department_id].order_count++;
    deptSummary[order.department_id].total_amount += order.total_amount;
  }
  
  res.json({
    items: result,
    department_summary: Object.values(deptSummary),
    total_orders: orders.length,
    total_amount: orders.reduce((sum, o) => sum + o.total_amount, 0)
  });
});

app.get('/api/department-budgets', (req, res) => {
  const db = readDB();
  const { month, department_id } = req.query;
  
  let budgets = db.department_budgets;
  
  if (month) {
    budgets = budgets.filter(b => b.budget_month === month);
  }
  if (department_id) {
    budgets = budgets.filter(b => b.department_id === parseInt(department_id));
  }
  
  const result = budgets.map(budget => {
    const dept = db.departments.find(d => d.id === budget.department_id);
    return {
      ...budget,
      department_name: dept ? dept.name : '',
      department_code: dept ? dept.code : '',
      remaining: budget.total_budget - budget.used_amount - budget.reserved_amount,
      usage_percentage: budget.total_budget > 0 ? ((budget.used_amount + budget.reserved_amount) / budget.total_budget * 100).toFixed(2) : 0
    };
  });
  
  res.json(result);
});

app.get('/api/settlements', (req, res) => {
  const db = readDB();
  const { department_id, status, start_date, end_date } = req.query;
  let settlements = [...db.settlements];
  
  if (department_id) {
    settlements = settlements.filter(s => s.department_id === parseInt(department_id));
  }
  if (status) {
    settlements = settlements.filter(s => s.status === status);
  }
  
  settlements.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const result = settlements.map(s => {
    const dept = db.departments.find(d => d.id === s.department_id);
    return {
      ...s,
      department_name: dept ? dept.name : ''
    };
  });
  
  res.json(result);
});

app.get('/api/settlements/:id', (req, res) => {
  const db = readDB();
  const settlement = db.settlements.find(s => s.id === parseInt(req.params.id));
  
  if (!settlement) {
    return res.status(404).json({ error: '结算单不存在' });
  }
  
  const dept = db.departments.find(d => d.id === settlement.department_id);
  const items = db.settlement_items.filter(i => i.settlement_id === settlement.id);
  
  const itemsWithDetail = items.map(item => {
    const employee = db.employees.find(e => e.id === item.employee_id);
    const order = db.orders.find(o => o.id === item.order_id);
    return {
      ...item,
      employee_name: employee ? employee.name : '',
      employee_no: employee ? employee.employee_no : '',
      order_no: order ? order.order_no : '',
      menu_date: order ? order.menu_date : '',
      meal_type: order ? order.meal_type : ''
    };
  });
  
  res.json({
    ...settlement,
    department_name: dept ? dept.name : '',
    items: itemsWithDetail
  });
});

app.post('/api/settlements/generate', (req, res) => {
  const db = readDB();
  const { department_id, start_date, end_date } = req.body;
  
  const dept = db.departments.find(d => d.id === department_id);
  if (!dept) {
    return res.status(400).json({ error: '部门不存在' });
  }
  
  const orders = db.orders.filter(o => 
    o.department_id === department_id &&
    o.menu_date >= start_date &&
    o.menu_date <= end_date &&
    o.status !== 'rejected'
  );
  
  if (orders.length === 0) {
    return res.status(400).json({ error: '该时间段内没有订单' });
  }
  
  const settlementId = db.settlements.length + 1;
  const settlementNo = generateSettlementNo();
  const now = new Date().toISOString();
  
  let totalAmount = 0;
  const settlementItems = [];
  let itemId = db.settlement_items.length + 1;
  
  for (const order of orders) {
    const orderAmount = order.is_cancelled === 1 ? order.cancel_fee : order.total_amount;
    totalAmount += orderAmount;
    settlementItems.push({
      id: itemId++,
      settlement_id: settlementId,
      order_id: order.id,
      employee_id: order.employee_id,
      order_amount: order.is_cancelled === 1 ? 0 : order.total_amount,
      cancel_fee: order.cancel_fee || 0,
      total: orderAmount
    });
  }
  
  const newSettlement = {
    id: settlementId,
    settlement_no: settlementNo,
    department_id,
    start_date,
    end_date,
    total_amount: totalAmount,
    order_count: orders.length,
    status: 'draft',
    settled_at: null,
    created_at: now
  };
  
  db.settlements.push(newSettlement);
  db.settlement_items.push(...settlementItems);
  writeDB(db);
  
  res.status(201).json({
    ...newSettlement,
    department_name: dept.name,
    items: settlementItems
  });
});

app.post('/api/settlements/:id/confirm', (req, res) => {
  const db = readDB();
  const settlement = db.settlements.find(s => s.id === parseInt(req.params.id));
  
  if (!settlement) {
    return res.status(404).json({ error: '结算单不存在' });
  }
  
  if (settlement.status === 'settled') {
    return res.status(400).json({ error: '结算单已确认' });
  }
  
  settlement.status = 'settled';
  settlement.settled_at = new Date().toISOString();
  
  writeDB(db);
  
  res.json(settlement);
});

app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json(db.settings);
});

app.put('/api/settings/:key', (req, res) => {
  const db = readDB();
  const { value } = req.body;
  const setting = db.settings.find(s => s.key === req.params.key);
  
  if (!setting) {
    return res.status(404).json({ error: '配置项不存在' });
  }
  
  setting.value = value;
  writeDB(db);
  
  res.json(setting);
});

app.get('/api/canteens', (req, res) => {
  const db = readDB();
  res.json(db.canteens);
});

app.post('/api/orders/:id/verify', (req, res) => {
  const db = readDB();
  const { verified_by } = req.body;
  const order = db.orders.find(o => o.id === parseInt(req.params.id));
  
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  if (order.is_cancelled === 1) {
    return res.status(400).json({ error: '订单已取消' });
  }
  
  if (order.verified === 1) {
    return res.status(400).json({ error: '订单已核销' });
  }
  
  if (order.status === 'pending_approval') {
    return res.status(400).json({ error: '订单待审批，无法核销' });
  }
  
  const now = new Date().toISOString();
  order.verified = 1;
  order.verified_at = now;
  order.verified_by = verified_by || 1;
  order.updated_at = now;
  
  const verifyId = db.verification_records.length + 1;
  db.verification_records.push({
    id: verifyId,
    order_id: order.id,
    order_no: order.order_no,
    employee_id: order.employee_id,
    verified_by: verified_by || 1,
    verified_at: now,
    created_at: now
  });

  writeOrderChangeLog(db, {
    order_id: order.id, order_no: order.order_no, change_type: 'verify',
    before_status: order.status, after_status: order.status + '_verified',
    operator_id: verified_by || 1,
    reason: '核销取餐',
    is_before_cutoff: 0
  });
  
  writeDB(db);
  res.json(order);
});

app.get('/api/inventory-transactions', (req, res) => {
  const db = readDB();
  const { menu_id, start_date, end_date } = req.query;
  let transactions = [...db.inventory_transactions];
  
  if (menu_id) {
    transactions = transactions.filter(t => t.menu_id === parseInt(menu_id));
  }
  if (start_date) {
    transactions = transactions.filter(t => t.created_at >= start_date);
  }
  if (end_date) {
    transactions = transactions.filter(t => t.created_at <= end_date + ' 23:59:59');
  }
  
  transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(transactions);
});

app.post('/api/waste-records', (req, res) => {
  const db = readDB();
  const { menu_id, daily_menu_id, quantity, reason, recorded_by } = req.body;
  const now = new Date().toISOString();
  
  const wasteId = db.waste_records.length + 1;
  const dailyMenu = db.daily_menus.find(dm => dm.id === parseInt(daily_menu_id));
  const menu = db.menus.find(m => m.id === parseInt(menu_id));
  
  const wasteRecord = {
    id: wasteId,
    menu_id: parseInt(menu_id),
    menu_name: menu ? menu.name : '',
    daily_menu_id: parseInt(daily_menu_id),
    menu_date: dailyMenu ? dailyMenu.menu_date : dayjs().format('YYYY-MM-DD'),
    meal_type: dailyMenu ? dailyMenu.meal_type : 'lunch',
    quantity: parseInt(quantity),
    amount: menu ? menu.price * parseInt(quantity) : 0,
    reason: reason || '',
    recorded_by: recorded_by || 1,
    created_at: now
  };
  
  db.waste_records.push(wasteRecord);
  
  if (dailyMenu) {
    dailyMenu.wasted_qty = (dailyMenu.wasted_qty || 0) + parseInt(quantity);
  }
  
  writeDB(db);
  res.status(201).json(wasteRecord);
});

app.get('/api/waste-records', (req, res) => {
  const db = readDB();
  const { start_date, end_date, meal_type } = req.query;
  let records = [...db.waste_records];
  
  if (start_date) {
    records = records.filter(r => r.menu_date >= start_date);
  }
  if (end_date) {
    records = records.filter(r => r.menu_date <= end_date);
  }
  if (meal_type) {
    records = records.filter(r => r.meal_type === meal_type);
  }
  
  records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(records);
});

app.get('/api/budget-freeze-records', (req, res) => {
  const db = readDB();
  const { department_id, status } = req.query;
  let records = [...db.budget_freeze_records];
  
  if (department_id) {
    records = records.filter(r => r.department_id === parseInt(department_id));
  }
  if (status) {
    records = records.filter(r => r.status === status);
  }
  
  records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(records);
});

app.post('/api/orders/:id/substitute', (req, res) => {
  const db = readDB();
  const { item_id, new_daily_menu_id, reason } = req.body;
  const order = db.orders.find(o => o.id === parseInt(req.params.id));
  
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  if (order.is_cancelled === 1) {
    return res.status(400).json({ error: '订单已取消' });
  }
  
  const orderItem = db.order_items.find(i => i.id === parseInt(item_id) && i.order_id === order.id);
  if (!orderItem) {
    return res.status(404).json({ error: '订单项不存在' });
  }
  
  const newDailyMenu = db.daily_menus.find(dm => dm.id === parseInt(new_daily_menu_id));
  if (!newDailyMenu) {
    return res.status(400).json({ error: '替换餐品不存在' });
  }
  
  if (newDailyMenu.stock < orderItem.quantity) {
    return res.status(400).json({ error: '替换餐品库存不足' });
  }
  
  const oldDailyMenu = db.daily_menus.find(dm => dm.id === orderItem.daily_menu_id);
  if (oldDailyMenu) {
    oldDailyMenu.stock += orderItem.quantity;
  }
  
  newDailyMenu.stock -= orderItem.quantity;
  
  const newMenu = db.menus.find(m => m.id === newDailyMenu.menu_id);
  const originalMenuId = orderItem.menu_id;
  const originalPrice = orderItem.price;
  const newPrice = newMenu ? newMenu.price : orderItem.price;
  const priceDiff = (newPrice - originalPrice) * orderItem.quantity;
  
  orderItem.is_substituted = 1;
  orderItem.original_menu_id = originalMenuId;
  orderItem.daily_menu_id = newDailyMenu.id;
  orderItem.menu_id = newDailyMenu.menu_id;
  orderItem.menu_name = newMenu ? newMenu.name : orderItem.menu_name;
  orderItem.price = newPrice;
  orderItem.subtotal = newPrice * orderItem.quantity;
  orderItem.substitute_reason = reason || '';
  orderItem.substitute_at = new Date().toISOString();
  
  order.total_amount += priceDiff;
  order.subsidy_amount = order.total_amount * (db.departments.find(d => d.id === order.department_id)?.subsidy_ratio || 0.7);
  order.personal_pay = order.total_amount - order.subsidy_amount;
  order.updated_at = new Date().toISOString();

  writeOrderChangeLog(db, {
    order_id: order.id, order_no: order.order_no, change_type: 'substitute',
    before_status: order.status, after_status: order.status,
    before_items: [{ menu_id: originalMenuId, name: '原菜品' }],
    after_items: [{ menu_id: newDailyMenu.menu_id, name: newMenu ? newMenu.name : '' }],
    amount_diff: priceDiff, operator_id: order.employee_id,
    reason: reason || '菜品替换',
    is_before_cutoff: isBeforeCutoff(order.menu_date, order.meal_type, order.is_extra === 1)
  });
  if (priceDiff !== 0) {
    const ledgerOrder = { ...order, amount_diff: priceDiff };
    writeFinanceLedgerForOrder(db, ledgerOrder, 'substitute', null);
  }
  
  writeDB(db);
  res.json({ order, item: orderItem });
});

app.post('/api/supplement-orders', (req, res) => {
  const db = readDB();
  const { original_order_id, employee_id, menu_date, meal_type, canteen_id, items, reason, is_extra } = req.body;
  
  const employee = db.employees.find(e => e.id === employee_id);
  if (!employee) {
    return res.status(400).json({ error: '员工不存在' });
  }
  
  const canteenId = parseInt(canteen_id) || items[0]?.canteen_id;
  if (!canteenId) {
    return res.status(400).json({ error: '请选择食堂' });
  }
  
  if (!items || items.length === 0) {
    return res.status(400).json({ error: '请选择餐品' });
  }
  
  let totalAmount = 0;
  const orderItems = [];
  const now = new Date().toISOString();
  
  for (const item of items) {
    const dailyMenu = db.daily_menus.find(dm => dm.id === item.daily_menu_id);
    if (!dailyMenu) {
      return res.status(400).json({ error: '餐品不存在' });
    }
    const menu = db.menus.find(m => m.id === dailyMenu.menu_id);
    if (!menu) {
      return res.status(400).json({ error: '餐品数据异常' });
    }
    if (dailyMenu.canteen_id !== canteenId) {
      return res.status(400).json({ error: `${menu.name}不属于当前所选食堂` });
    }
    if (dailyMenu.stock < item.quantity) {
      return res.status(400).json({ error: `${menu.name}库存不足` });
    }
    const subtotal = menu.price * item.quantity;
    totalAmount += subtotal;
    orderItems.push({
      daily_menu_id: dailyMenu.id,
      menu_id: dailyMenu.menu_id,
      canteen_id: canteenId,
      menu_name: menu.name,
      price: menu.price,
      quantity: item.quantity,
      subtotal
    });
  }
  
  const dept = db.departments.find(d => d.id === employee.department_id);
  const subsidyRatio = dept?.subsidy_ratio || 0.7;
  const subsidyAmount = totalAmount * subsidyRatio;
  const personalPay = totalAmount - subsidyAmount;
  
  const orderId = getNextId('orders');
  const orderNo = generateOrderNo();
  
  const newOrder = {
    id: orderId,
    order_no: orderNo,
    employee_id,
    department_id: employee.department_id,
    canteen_id: canteenId,
    menu_date,
    meal_type,
    total_amount: totalAmount,
    personal_pay: personalPay,
    subsidy_amount: subsidyAmount,
    status: 'confirmed',
    cancel_fee: 0,
    is_cancelled: 0,
    is_extra: is_extra ? 1 : 0,
    is_supplement: 1,
    cancelled_at: null,
    approved_by: null,
    approved_at: null,
    reject_reason: null,
    verified: 0,
    created_at: now,
    updated_at: now,
    remark: reason || ''
  };
  
  const orderItemsWithId = orderItems.map((item, idx) => ({
    id: db.order_items.length + idx + 1,
    order_id: orderId,
    ...item,
    created_at: now
  }));
  
  for (const item of items) {
    const dailyMenu = db.daily_menus.find(dm => dm.id === item.daily_menu_id);
    dailyMenu.stock -= item.quantity;
    
    const menu = db.menus.find(m => m.id === dailyMenu.menu_id);
    db.inventory_transactions.push({
      id: db.inventory_transactions.length + 1,
      menu_id: dailyMenu.menu_id,
      menu_name: menu ? menu.name : '',
      daily_menu_id: dailyMenu.id,
      change_type: 'out',
      quantity: item.quantity,
      reason: is_extra ? '临时加餐' : '补改单',
      ref_order_no: orderNo,
      created_at: now
    });
  }
  
  const budgetMonth = dayjs(menu_date).format('YYYY-MM');
  let budget = db.department_budgets.find(b => b.department_id === employee.department_id && b.budget_month === budgetMonth);
  if (!budget) {
    budget = {
      id: db.department_budgets.length + 1,
      department_id: employee.department_id,
      budget_month: budgetMonth,
      total_budget: dept.monthly_budget || 10000,
      used_amount: 0,
      reserved_amount: 0,
      created_at: now,
      updated_at: now
    };
    db.department_budgets.push(budget);
  }
  budget.used_amount += totalAmount;
  budget.updated_at = now;
  
  const supplementId = db.supplement_orders.length + 1;
  db.supplement_orders.push({
    id: supplementId,
    original_order_id: original_order_id || null,
    new_order_id: orderId,
    new_order_no: orderNo,
    reason: reason || '',
    is_extra: is_extra ? 1 : 0,
    diff_amount: totalAmount,
    created_by: employee_id,
    created_at: now
  });
  
  db.orders.push(newOrder);
  db.order_items.push(...orderItemsWithId);

  writeOrderChangeLog(db, {
    order_id: orderId, order_no: orderNo, change_type: 'supplement',
    before_status: '', after_status: 'confirmed',
    amount_diff: totalAmount, operator_id: employee_id,
    reason: is_extra ? '临时加餐' : (reason || '补改单'),
    is_before_cutoff: is_extra ? 1 : 0
  });
  writeFinanceLedgerForOrder(db, newOrder, 'create', null);

  writeDB(db);
  
  res.status(201).json({
    ...newOrder,
    employee_name: employee.name,
    department_name: dept.name,
    items: orderItemsWithId
  });
});

app.get('/api/reconciliation-diff', (req, res) => {
  const db = readDB();
  const { department_id, start_date, end_date } = req.query;
  
  let orders = db.orders.filter(o => o.status !== 'rejected');
  
  if (department_id) {
    orders = orders.filter(o => o.department_id === parseInt(department_id));
  }
  if (start_date) {
    orders = orders.filter(o => o.menu_date >= start_date);
  }
  if (end_date) {
    orders = orders.filter(o => o.menu_date <= end_date);
  }
  
  const diffItems = [];
  let totalSystemAmount = 0;
  let totalActualAmount = 0;
  let totalDiff = 0;
  
  for (const order of orders) {
    const dept = db.departments.find(d => d.id === order.department_id);
    const employee = db.employees.find(e => e.id === order.employee_id);
    const subsidyRatio = dept?.subsidy_ratio || 0.7;
    
    const expectedSubsidy = order.total_amount * subsidyRatio;
    const expectedPersonal = order.total_amount - expectedSubsidy;
    const actualSubsidy = order.subsidy_amount || expectedSubsidy;
    const actualPersonal = order.personal_pay || expectedPersonal;
    
    const subsidyDiff = actualSubsidy - expectedSubsidy;
    const personalDiff = actualPersonal - expectedPersonal;
    const cancelFee = order.cancel_fee || 0;
    const hasAbnormal = order.is_cancelled === 1 || cancelFee > 0 || Math.abs(subsidyDiff) > 0.01 || Math.abs(personalDiff) > 0.01;
    
    totalSystemAmount += order.total_amount;
    totalActualAmount += (actualSubsidy + actualPersonal + cancelFee);
    totalDiff += (subsidyDiff + personalDiff + cancelFee);
    
    if (hasAbnormal) {
      diffItems.push({
        order_id: order.id,
        order_no: order.order_no,
        employee_id: order.employee_id,
        employee_name: employee ? employee.name : '',
        department_id: order.department_id,
        department_name: dept ? dept.name : '',
        menu_date: order.menu_date,
        meal_type: order.meal_type,
        is_cancelled: order.is_cancelled,
        total_amount: order.total_amount,
        expected_subsidy: parseFloat(expectedSubsidy.toFixed(2)),
        expected_personal: parseFloat(expectedPersonal.toFixed(2)),
        actual_subsidy: parseFloat(actualSubsidy.toFixed(2)),
        actual_personal: parseFloat(actualPersonal.toFixed(2)),
        subsidy_diff: parseFloat(subsidyDiff.toFixed(2)),
        personal_diff: parseFloat(personalDiff.toFixed(2)),
        cancel_fee: cancelFee,
        total_diff: parseFloat((subsidyDiff + personalDiff + cancelFee).toFixed(2)),
        abnormal_types: [
          order.is_cancelled === 1 ? '已取消' : null,
          cancelFee > 0 ? '取消费' : null,
          Math.abs(subsidyDiff) > 0.01 ? '补贴差异' : null,
          Math.abs(personalDiff) > 0.01 ? '自付差异' : null
        ].filter(Boolean)
      });
    }
  }
  
  res.json({
    summary: {
      order_count: orders.length,
      abnormal_count: diffItems.length,
      total_system_amount: parseFloat(totalSystemAmount.toFixed(2)),
      total_actual_amount: parseFloat(totalActualAmount.toFixed(2)),
      total_diff: parseFloat(totalDiff.toFixed(2))
    },
    items: diffItems.sort((a, b) => new Date(b.menu_date) - new Date(a.menu_date))
  });
});

app.post('/api/settlements/:id/recalculate', (req, res) => {
  const db = readDB();
  const settlement = db.settlements.find(s => s.id === parseInt(req.params.id));
  
  if (!settlement) {
    return res.status(404).json({ error: '结算单不存在' });
  }
  
  const dept = db.departments.find(d => d.id === settlement.department_id);
  const subsidyRatio = dept?.subsidy_ratio || 0.7;
  
  const orders = db.orders.filter(o => 
    o.department_id === settlement.department_id &&
    o.menu_date >= settlement.start_date &&
    o.menu_date <= settlement.end_date &&
    o.status !== 'rejected'
  );
  
  let totalAmount = 0;
  let totalSubsidy = 0;
  let totalPersonal = 0;
  let totalCancelFee = 0;
  let totalAbnormalFee = 0;
  const settlementItems = [];
  let itemId = db.settlement_items.findIndex(i => i.settlement_id === settlement.id);
  if (itemId === -1) itemId = db.settlement_items.length;
  else itemId = db.settlement_items.filter(i => i.settlement_id === settlement.id).length;
  itemId = db.settlement_items.length + 1;
  
  const existingItems = db.settlement_items.filter(i => i.settlement_id === settlement.id);
  db.settlement_items = db.settlement_items.filter(i => i.settlement_id !== settlement.id);
  
  for (const order of orders) {
    const orderAmount = order.is_cancelled === 1 ? order.cancel_fee : order.total_amount;
    const orderSubsidy = order.is_cancelled === 1 ? 0 : (order.subsidy_amount || order.total_amount * subsidyRatio);
    const orderPersonal = order.is_cancelled === 1 ? 0 : (order.personal_pay || order.total_amount * (1 - subsidyRatio));
    const cancelFee = order.cancel_fee || 0;
    const abnormalFee = cancelFee;
    
    totalAmount += orderAmount;
    totalSubsidy += orderSubsidy;
    totalPersonal += orderPersonal;
    totalCancelFee += cancelFee;
    totalAbnormalFee += abnormalFee;
    
    settlementItems.push({
      id: itemId++,
      settlement_id: settlement.id,
      order_id: order.id,
      employee_id: order.employee_id,
      order_amount: order.is_cancelled === 1 ? 0 : order.total_amount,
      subsidy_amount: parseFloat(orderSubsidy.toFixed(2)),
      personal_pay: parseFloat(orderPersonal.toFixed(2)),
      cancel_fee: cancelFee,
      abnormal_fee: parseFloat(abnormalFee.toFixed(2)),
      total: parseFloat(orderAmount.toFixed(2))
    });
  }
  
  const diffAmount = parseFloat((totalAmount - settlement.total_amount).toFixed(2));
  
  settlement.total_amount = parseFloat(totalAmount.toFixed(2));
  settlement.total_subsidy = parseFloat(totalSubsidy.toFixed(2));
  settlement.total_personal = parseFloat(totalPersonal.toFixed(2));
  settlement.total_cancel_fee = parseFloat(totalCancelFee.toFixed(2));
  settlement.total_abnormal_fee = parseFloat(totalAbnormalFee.toFixed(2));
  settlement.diff_amount = diffAmount;
  settlement.recalculate_count = (settlement.recalculate_count || 0) + 1;
  settlement.last_recalculate_at = new Date().toISOString();
  settlement.order_count = orders.length;
  
  db.settlement_items.push(...settlementItems);
  writeDB(db);
  
  res.json({
    ...settlement,
    department_name: dept ? dept.name : '',
    items: settlementItems,
    diff_amount: diffAmount
  });
});

app.get('/api/dashboard/stats', (req, res) => {
  const db = readDB();
  const today = dayjs().format('YYYY-MM-DD');
  
  const todayOrders = db.orders.filter(o => o.menu_date === today && o.status === 'confirmed' && o.is_cancelled === 0);
  const lunchOrders = todayOrders.filter(o => o.meal_type === 'lunch');
  const dinnerOrders = todayOrders.filter(o => o.meal_type === 'dinner');
  const breakfastOrders = todayOrders.filter(o => o.meal_type === 'breakfast');
  
  const pendingApprovals = db.approvals.filter(a => a.status === 'pending').length;
  const verifiedCount = todayOrders.filter(o => o.verified === 1).length;
  const wastedCount = db.waste_records.filter(w => w.menu_date === today).reduce((sum, w) => sum + w.quantity, 0);
  
  const departmentStats = [];
  for (const dept of db.departments) {
    const deptOrders = todayOrders.filter(o => o.department_id === dept.id);
    const amount = deptOrders.reduce((sum, o) => sum + o.total_amount, 0);
    departmentStats.push({
      department_id: dept.id,
      department_name: dept.name,
      order_count: deptOrders.length,
      total_amount: amount
    });
  }
  
  const canteenStats = [];
  for (const canteen of db.canteens) {
    const canteenOrders = todayOrders.filter(o => o.canteen_id === canteen.id);
    canteenStats.push({
      canteen_id: canteen.id,
      canteen_name: canteen.name,
      order_count: canteenOrders.length,
      total_amount: canteenOrders.reduce((sum, o) => sum + o.total_amount, 0)
    });
  }
  
  res.json({
    today_total_orders: todayOrders.length,
    breakfast_orders: breakfastOrders.length,
    lunch_orders: lunchOrders.length,
    dinner_orders: dinnerOrders.length,
    today_total_amount: todayOrders.reduce((sum, o) => sum + o.total_amount, 0),
    pending_approvals: pendingApprovals,
    verified_count: verifiedCount,
    wasted_count: wastedCount,
    department_stats: departmentStats.sort((a, b) => b.order_count - a.order_count),
    canteen_stats: canteenStats
  });
});

app.get('/api/canteen-windows', (req, res) => {
  const db = readDB();
  const { canteen_id } = req.query;
  let windows = db.canteen_windows || [];
  if (canteen_id) windows = windows.filter(w => w.canteen_id === parseInt(canteen_id));
  res.json(windows);
});

app.get('/api/delivery-floors', (req, res) => {
  const db = readDB();
  const { canteen_id } = req.query;
  let floors = db.delivery_floors || [];
  if (canteen_id) floors = floors.filter(f => f.canteen_id === parseInt(canteen_id));
  res.json(floors);
});

app.get('/api/menu-ingredients', (req, res) => {
  const db = readDB();
  const { menu_id, is_allergen } = req.query;
  let items = db.menu_ingredients || [];
  if (menu_id) items = items.filter(i => i.menu_id === parseInt(menu_id));
  if (is_allergen !== undefined) items = items.filter(i => i.is_allergen === parseInt(is_allergen));
  res.json(items);
});

app.get('/api/prep-diff', (req, res) => {
  const db = readDB();
  const { date, meal_type, canteen_id, group_by } = req.query;
  if (!date) return res.status(400).json({ error: '请提供日期参数' });

  let orders = db.orders.filter(o =>
    (o.status === 'confirmed' || o.status === 'pending_approval') &&
    o.is_cancelled === 0 &&
    o.menu_date === date
  );
  if (meal_type) orders = orders.filter(o => o.meal_type === meal_type);
  if (canteen_id) orders = orders.filter(o => o.canteen_id === parseInt(canteen_id));

  const confirmedOrders = orders.filter(o => o.status === 'confirmed');
  const pendingOrders = orders.filter(o => o.status === 'pending_approval');

  const byWindow = {};
  const byIngredient = {};
  const byAllergen = {};
  const byFloor = {};

  const buildBreakdown = (orderList, tag) => {
    for (const order of orderList) {
      const items = db.order_items.filter(i => i.order_id === order.id);
      for (const item of items) {
        const menu = db.menus.find(m => m.id === item.menu_id);
        const category = menu ? menu.category : '其他';
        const windows = (db.canteen_windows || []).filter(w => w.canteen_id === order.canteen_id && w.category === category);
        const winName = windows.length > 0 ? windows[0].name : `${db.canteens.find(c => c.id === order.canteen_id)?.name || '未知'}-${category}`;

        if (!byWindow[winName]) byWindow[winName] = { window_name: winName, canteen_id: order.canteen_id, category, confirmed_qty: 0, pending_qty: 0, total_qty: 0, menu_items: {} };
        byWindow[winName][`${tag}_qty`] += item.quantity;
        byWindow[winName].total_qty += item.quantity;
        if (!byWindow[winName].menu_items[item.menu_name]) byWindow[winName].menu_items[item.menu_name] = { confirmed_qty: 0, pending_qty: 0 };
        byWindow[winName].menu_items[item.menu_name][`${tag}_qty`] += item.quantity;

        const ingredients = (db.menu_ingredients || []).filter(mi => mi.menu_id === item.menu_id);
        for (const ing of ingredients) {
          if (!byIngredient[ing.ingredient_name]) byIngredient[ing.ingredient_name] = { ingredient_name: ing.ingredient_name, is_allergen: ing.is_allergen, confirmed_qty: 0, pending_qty: 0, total_qty: 0 };
          byIngredient[ing.ingredient_name][`${tag}_qty`] += item.quantity;
          byIngredient[ing.ingredient_name].total_qty += item.quantity;
          if (ing.is_allergen === 1) {
            if (!byAllergen[ing.ingredient_name]) byAllergen[ing.ingredient_name] = { allergen_name: ing.ingredient_name, confirmed_qty: 0, pending_qty: 0, total_qty: 0, affected_employees: new Set() };
            byAllergen[ing.ingredient_name][`${tag}_qty`] += item.quantity;
            byAllergen[ing.ingredient_name].total_qty += item.quantity;
            const emp = db.employees.find(e => e.id === order.employee_id);
            if (emp && emp.allergens && emp.allergens.includes(ing.ingredient_name)) {
              byAllergen[ing.ingredient_name].affected_employees.add(`${emp.name}(${emp.employee_no})`);
            }
          }
        }

        const floors = (db.delivery_floors || []).filter(f => f.canteen_id === order.canteen_id && f.department_ids && f.department_ids.includes(order.department_id));
        for (const fl of floors) {
          const flKey = `${fl.building}-${fl.floor}`;
          if (!byFloor[flKey]) byFloor[flKey] = { building: fl.building, floor: fl.floor, canteen_id: order.canteen_id, confirmed_qty: 0, pending_qty: 0, total_qty: 0, departments: new Set() };
          byFloor[flKey][`${tag}_qty`] += item.quantity;
          byFloor[flKey].total_qty += item.quantity;
          const dept = db.departments.find(d => d.id === order.department_id);
          if (dept) byFloor[flKey].departments.add(dept.name);
        }
      }
    }
  };

  buildBreakdown(confirmedOrders, 'confirmed');
  buildBreakdown(pendingOrders, 'pending');

  const formatSet = (obj) => {
    return Object.values(obj).map(v => {
      const cloned = { ...v };
      if (cloned.affected_employees) cloned.affected_employees = [...cloned.affected_employees];
      if (cloned.departments) cloned.departments = [...cloned.departments];
      if (cloned.menu_items) cloned.menu_items = { ...cloned.menu_items };
      return cloned;
    });
  };

  const diffs = (db.prep_diff_records || []).filter(d => d.menu_date === date && (!meal_type || d.meal_type === meal_type));

  res.json({
    by_window: formatSet(byWindow),
    by_ingredient: formatSet(byIngredient),
    by_allergen: formatSet(byAllergen),
    by_floor: formatSet(byFloor),
    diff_records: diffs,
    summary: {
      confirmed_orders: confirmedOrders.length,
      pending_orders: pendingOrders.length,
      total_orders: orders.length
    }
  });
});

app.post('/api/prep-diff', (req, res) => {
  const db = readDB();
  const { menu_date, meal_type, canteen_id, menu_id, menu_name, diff_quantity, diff_type, reason } = req.body;
  const now = new Date().toISOString();
  const recordId = (db.prep_diff_records || []).length + 1;
  if (!db.prep_diff_records) db.prep_diff_records = [];
  const record = {
    id: recordId,
    menu_date,
    meal_type: meal_type || 'lunch',
    canteen_id: canteen_id || 1,
    menu_id,
    menu_name,
    diff_quantity: parseInt(diff_quantity),
    diff_type: diff_type || 'supplement',
    reason: reason || '',
    created_at: now
  };
  db.prep_diff_records.push(record);
  writeDB(db);
  res.status(201).json(record);
});

app.get('/api/order-change-logs', (req, res) => {
  const db = readDB();
  const { order_id, change_type, start_date, end_date } = req.query;
  let logs = db.order_change_logs || [];
  if (order_id) logs = logs.filter(l => l.order_id === parseInt(order_id));
  if (change_type) logs = logs.filter(l => l.change_type === change_type);
  if (start_date) logs = logs.filter(l => l.created_at >= start_date);
  if (end_date) logs = logs.filter(l => l.created_at <= end_date + ' 23:59:59');
  logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const result = logs.map(l => {
    const emp = db.employees.find(e => e.id === l.operator_id);
    return { ...l, operator_name: emp ? emp.name : '' };
  });
  res.json(result);
});

app.get('/api/finance-ledger', (req, res) => {
  const db = readDB();
  const { department_id, entry_type, start_date, end_date, menu_date, order_id } = req.query;
  let entries = db.finance_ledger_entries || [];
  if (department_id) entries = entries.filter(e => e.department_id === parseInt(department_id));
  if (entry_type) entries = entries.filter(e => e.entry_type === entry_type);
  if (menu_date) entries = entries.filter(e => e.menu_date === menu_date);
  if (order_id) entries = entries.filter(e => e.order_id === parseInt(order_id));
  if (start_date) entries = entries.filter(e => e.menu_date >= start_date);
  if (end_date) entries = entries.filter(e => e.menu_date <= end_date);

  entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const typeSummary = {};
  for (const e of entries) {
    if (!typeSummary[e.entry_type]) typeSummary[e.entry_type] = { entry_type: e.entry_type, count: 0, total_amount: 0 };
    typeSummary[e.entry_type].count++;
    typeSummary[e.entry_type].total_amount += e.amount;
  }

  const deptSummary = {};
  for (const e of entries) {
    if (!deptSummary[e.department_id]) {
      const dept = db.departments.find(d => d.id === e.department_id);
      deptSummary[e.department_id] = { department_id: e.department_id, department_name: dept ? dept.name : '', total_amount: 0, by_type: {} };
    }
    deptSummary[e.department_id].total_amount += e.amount;
    if (!deptSummary[e.department_id].by_type[e.entry_type]) deptSummary[e.department_id].by_type[e.entry_type] = 0;
    deptSummary[e.department_id].by_type[e.entry_type] += e.amount;
  }

  res.json({
    entries: entries.map(e => {
      const emp = db.employees.find(em => em.id === e.employee_id);
      const dept = db.departments.find(d => d.id === e.department_id);
      return { ...e, employee_name: emp ? emp.name : '', department_name: dept ? dept.name : '' };
    }),
    type_summary: Object.values(typeSummary).map(s => ({ ...s, total_amount: +s.total_amount.toFixed(2) })),
    department_summary: Object.values(deptSummary).map(s => ({
      ...s, total_amount: +s.total_amount.toFixed(2),
      by_type: Object.fromEntries(Object.entries(s.by_type).map(([k, v]) => [k, +v.toFixed(2)]))
    })),
    total_entries: entries.length
  });
});

app.post('/api/finance-ledger/recalculate', (req, res) => {
  const db = readDB();
  const { month, department_id } = req.body;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: '请提供有效的月份参数，格式为 YYYY-MM' });
  }

  const y = parseInt(month.substring(0, 4), 10);
  const m = parseInt(month.substring(5, 7), 10);
  const start_date = `${month}-01`;
  const endDateObj = new Date(y, m, 0);
  const end_date = `${month}-${String(endDateObj.getDate()).padStart(2, '0')}`;

  const deptIds = department_id
    ? [parseInt(department_id, 10)]
    : db.departments.map(d => d.id);

  const orders = db.orders.filter(o =>
    deptIds.includes(o.department_id) &&
    o.menu_date >= start_date &&
    o.menu_date <= end_date
  );

  const oldEntries = db.finance_ledger_entries.filter(e =>
    deptIds.includes(e.department_id) &&
    e.menu_date >= start_date &&
    e.menu_date <= end_date
  );

  db.finance_ledger_entries = db.finance_ledger_entries.filter(e =>
    !(deptIds.includes(e.department_id) && e.menu_date >= start_date && e.menu_date <= end_date)
  );

  const logMap = {};
  for (const log of db.order_change_logs) {
    if (!logMap[log.order_id]) logMap[log.order_id] = [];
    logMap[log.order_id].push(log);
  }
  for (const oid of Object.keys(logMap)) {
    logMap[oid].sort((a, b) => a.id - b.id);
  }

  const logs = db.order_change_logs.filter(l => {
    const o = db.orders.find(o => o.id === l.order_id);
    if (!o) return false;
    return deptIds.includes(o.department_id) && o.menu_date >= start_date && o.menu_date <= end_date;
  }).sort((a, b) => a.id - b.id);

  for (const log of logs) {
    const order = orders.find(o => o.id === log.order_id);
    if (!order) continue;
    const t = log.change_type;

    if (t === 'create' || t === 'approve' || t === 'supplement') {
      writeFinanceLedgerForOrder(db, order, 'create', log.id);
    } else if (t === 'cancel') {
      writeFinanceLedgerForOrder(db, order, 'cancel', log.id);
    } else if (t === 'substitute' && log.amount_diff && log.amount_diff !== 0) {
      const adjustedOrder = { ...order, amount_diff: log.amount_diff };
      writeFinanceLedgerForOrder(db, adjustedOrder, 'substitute', log.id);
    }
  }

  writeDB(db);

  const newEntries = db.finance_ledger_entries.filter(e =>
    deptIds.includes(e.department_id) && e.menu_date >= start_date && e.menu_date <= end_date
  );

  const typeTotals = {};
  for (const e of newEntries) {
    typeTotals[e.entry_type] = (typeTotals[e.entry_type] || 0) + e.amount;
  }

  res.json({
    month,
    start_date,
    end_date,
    department_count: deptIds.length,
    recalculated_orders: orders.length,
    processed_change_logs: logs.length,
    removed_entries: oldEntries.length,
    new_entries: newEntries.length,
    type_totals: typeTotals,
    dept_ids: deptIds,
  });
});

function writeOrderChangeLog(db, params) {
  const logId = db.order_change_logs.length + 1;
  db.order_change_logs.push({
    id: logId,
    order_id: params.order_id,
    order_no: params.order_no,
    change_type: params.change_type,
    before_status: params.before_status || '',
    after_status: params.after_status || '',
    before_items: params.before_items ? JSON.stringify(params.before_items) : null,
    after_items: params.after_items ? JSON.stringify(params.after_items) : null,
    amount_diff: params.amount_diff || 0,
    operator_id: params.operator_id || null,
    reason: params.reason || '',
    is_before_cutoff: params.is_before_cutoff !== undefined ? params.is_before_cutoff : 1,
    created_at: new Date().toISOString()
  });
}

function writeFinanceLedgerEntry(db, params) {
  const entryId = db.finance_ledger_entries.length + 1;
  db.finance_ledger_entries.push({
    id: entryId,
    order_id: params.order_id,
    order_no: params.order_no,
    employee_id: params.employee_id,
    department_id: params.department_id,
    canteen_id: params.canteen_id,
    menu_date: params.menu_date,
    meal_type: params.meal_type,
    entry_type: params.entry_type,
    amount: params.amount,
    is_extra: params.is_extra || 0,
    project_id: params.project_id || null,
    remark: params.remark || '',
    source_log_id: params.source_log_id || null,
    created_at: new Date().toISOString()
  });
}

function writeFinanceLedgerForOrder(db, order, changeType, sourceLogId) {
  const dept = db.departments.find(d => d.id === order.department_id);
  const subsidyRatio = dept ? dept.subsidy_ratio : 0.7;
  const baseNo = order.order_no;
  const baseDate = order.menu_date;
  const baseMeal = order.meal_type;
  const baseCanteen = order.canteen_id;
  const baseEmp = order.employee_id;
  const baseDept = order.department_id;

  if (changeType === 'create' || changeType === 'approve') {
    writeFinanceLedgerEntry(db, {
      order_id: order.id, order_no: baseNo, employee_id: baseEmp,
      department_id: baseDept, canteen_id: baseCanteen,
      menu_date: baseDate, meal_type: baseMeal,
      entry_type: 'subsidy', amount: +(order.total_amount * subsidyRatio).toFixed(2),
      is_extra: order.is_extra, project_id: null, remark: '补贴入账',
      source_log_id: sourceLogId
    });
    writeFinanceLedgerEntry(db, {
      order_id: order.id, order_no: baseNo, employee_id: baseEmp,
      department_id: baseDept, canteen_id: baseCanteen,
      menu_date: baseDate, meal_type: baseMeal,
      entry_type: 'personal', amount: +(order.total_amount * (1 - subsidyRatio)).toFixed(2),
      is_extra: order.is_extra, project_id: null, remark: '个人自费入账',
      source_log_id: sourceLogId
    });
    writeFinanceLedgerEntry(db, {
      order_id: order.id, order_no: baseNo, employee_id: baseEmp,
      department_id: baseDept, canteen_id: baseCanteen,
      menu_date: baseDate, meal_type: baseMeal,
      entry_type: 'budget_use', amount: +order.total_amount.toFixed(2),
      is_extra: order.is_extra, project_id: null, remark: '部门预算占用',
      source_log_id: sourceLogId
    });
    if (order.share_dept_ids && order.share_dept_ids.length > 0) {
      const sharePerDept = +(order.total_amount / (order.share_dept_ids.length + 1)).toFixed(2);
      for (const sdid of order.share_dept_ids) {
        writeFinanceLedgerEntry(db, {
          order_id: order.id, order_no: baseNo, employee_id: baseEmp,
          department_id: sdid, canteen_id: baseCanteen,
          menu_date: baseDate, meal_type: baseMeal,
          entry_type: 'project_share', amount: sharePerDept,
          is_extra: order.is_extra, project_id: null, remark: '项目分摊入账',
          source_log_id: sourceLogId
        });
      }
    }
  } else if (changeType === 'cancel') {
    writeFinanceLedgerEntry(db, {
      order_id: order.id, order_no: baseNo, employee_id: baseEmp,
      department_id: baseDept, canteen_id: baseCanteen,
      menu_date: baseDate, meal_type: baseMeal,
      entry_type: 'subsidy_reverse', amount: +(-order.total_amount * subsidyRatio).toFixed(2),
      is_extra: order.is_extra, project_id: null, remark: '补贴冲回',
      source_log_id: sourceLogId
    });
    writeFinanceLedgerEntry(db, {
      order_id: order.id, order_no: baseNo, employee_id: baseEmp,
      department_id: baseDept, canteen_id: baseCanteen,
      menu_date: baseDate, meal_type: baseMeal,
      entry_type: 'personal_reverse', amount: +(-order.total_amount * (1 - subsidyRatio)).toFixed(2),
      is_extra: order.is_extra, project_id: null, remark: '个人自费冲回',
      source_log_id: sourceLogId
    });
    writeFinanceLedgerEntry(db, {
      order_id: order.id, order_no: baseNo, employee_id: baseEmp,
      department_id: baseDept, canteen_id: baseCanteen,
      menu_date: baseDate, meal_type: baseMeal,
      entry_type: 'budget_release', amount: +order.total_amount.toFixed(2),
      is_extra: order.is_extra, project_id: null, remark: '部门预算释放',
      source_log_id: sourceLogId
    });
    if (order.cancel_fee > 0) {
      writeFinanceLedgerEntry(db, {
        order_id: order.id, order_no: baseNo, employee_id: baseEmp,
        department_id: baseDept, canteen_id: baseCanteen,
        menu_date: baseDate, meal_type: baseMeal,
        entry_type: 'overtime_fee', amount: +order.cancel_fee.toFixed(2),
        is_extra: order.is_extra, project_id: null, remark: '超时取消费',
        source_log_id: sourceLogId
      });
    }
  } else if (changeType === 'substitute') {
    if (order.amount_diff && order.amount_diff !== 0) {
      writeFinanceLedgerEntry(db, {
        order_id: order.id, order_no: baseNo, employee_id: baseEmp,
        department_id: baseDept, canteen_id: baseCanteen,
        menu_date: baseDate, meal_type: baseMeal,
        entry_type: 'subsidy_adjust', amount: +(order.amount_diff * subsidyRatio).toFixed(2),
        is_extra: order.is_extra, project_id: null, remark: '换菜补贴调整',
        source_log_id: sourceLogId
      });
      writeFinanceLedgerEntry(db, {
        order_id: order.id, order_no: baseNo, employee_id: baseEmp,
        department_id: baseDept, canteen_id: baseCanteen,
        menu_date: baseDate, meal_type: baseMeal,
        entry_type: 'personal_adjust', amount: +(order.amount_diff * (1 - subsidyRatio)).toFixed(2),
        is_extra: order.is_extra, project_id: null, remark: '换菜自费调整',
        source_log_id: sourceLogId
      });
    }
  }
}

app.listen(PORT, () => {
  console.log(`团餐订餐结算系统后端服务运行在端口 ${PORT}`);
  console.log(`API 基础地址: http://localhost:${PORT}/api`);
});
