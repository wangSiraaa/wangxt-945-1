const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function pad(num) {
  return num.toString().padStart(3, '0');
}

const db = readDB();

const existingKeys = new Set();
db.daily_menus.forEach(dm => {
  existingKeys.add(`${dm.canteen_id}_${dm.menu_date}_${dm.meal_type}_${dm.menu_id}`);
});

const canteens = db.canteens;
const menus = db.menus;
const dates = ['2026-06-12', '2026-06-13'];

const canteenMenuConfig = {
  1: {
    name: '总部食堂A',
    breakfast: [11, 12],
    lunch: [1, 2, 3, 4],
    dinner: [5, 6, 11, 12]
  },
  2: {
    name: '总部食堂B',
    breakfast: [11, 12],
    lunch: [7, 8, 9],
    dinner: [6, 10]
  },
  3: {
    name: '分部食堂',
    breakfast: [11, 12],
    lunch: [2, 3, 5, 9],
    dinner: [4, 6, 7]
  }
};

const baseStock = {
  1: { breakfast: 80, lunch: 100, dinner: 80 },
  2: { breakfast: 50, lunch: 60, dinner: 50 },
  3: { breakfast: 40, lunch: 60, dinner: 45 }
};

const basePredict = {
  1: { breakfast: 65, lunch: 85, dinner: 65 },
  2: { breakfast: 40, lunch: 50, dinner: 40 },
  3: { breakfast: 30, lunch: 48, dinner: 35 }
};

let nextId = Math.max(...db.daily_menus.map(dm => dm.id)) + 1;
let addedCount = 0;

for (const date of dates) {
  for (const canteen of canteens) {
    const config = canteenMenuConfig[canteen.id];
    if (!config) continue;

    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const menuIds = config[mealType] || [];
      for (let i = 0; i < menuIds.length; i++) {
        const menuId = menuIds[i];
        const key = `${canteen.id}_${date}_${mealType}_${menuId}`;

        if (!existingKeys.has(key)) {
          const stockBase = baseStock[canteen.id][mealType];
          const predictBase = basePredict[canteen.id][mealType];
          const variance = (i - Math.floor(menuIds.length / 2)) * 5;

          db.daily_menus.push({
            id: nextId++,
            canteen_id: canteen.id,
            menu_date: date,
            menu_id: menuId,
            meal_type: mealType,
            stock: stockBase + variance,
            predict_qty: predictBase + variance,
            created_at: new Date().toISOString()
          });
          addedCount++;
          existingKeys.add(key);
          console.log(`  + 新增: 食堂${canteen.id}(${config.name}) | ${date} | ${mealType} | 菜单${menuId}(${menus.find(m => m.id === menuId)?.name}) | 库存${stockBase + variance} | 预测${predictBase + variance}`);
        }
      }
    }
  }
}

writeDB(db);

console.log(`\n完成！共新增 ${addedCount} 条每日菜单记录`);
console.log(`当前 daily_menus 总数: ${db.daily_menus.length}`);

const summary = {};
db.daily_menus.forEach(dm => {
  const k = `食堂${dm.canteen_id}`;
  if (!summary[k]) summary[k] = { total: 0, breakfast: 0, lunch: 0, dinner: 0, dates: new Set() };
  summary[k].total++;
  summary[k][dm.meal_type]++;
  summary[k].dates.add(dm.menu_date);
});

console.log('\n各食堂分布统计:');
for (const [k, v] of Object.entries(summary)) {
  console.log(`  ${k}: 共${v.total}条 (早${v.breakfast}/午${v.lunch}/晚${v.dinner}) 覆盖${v.dates.size}天 [${[...v.dates].join(', ')}]`);
}
