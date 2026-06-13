import React, { useState, useEffect } from 'react';
import { DatePicker, Segmented, Card, Row, Col, Tag, Spin, message, Empty, Badge } from 'antd';
import { menuApi } from '../api';
import dayjs from 'dayjs';

export default function MenuPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [mealType, setMealType] = useState('lunch');
  const [dailyMenus, setDailyMenus] = useState([]);
  const [allMenus, setAllMenus] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMenus();
  }, [date, mealType]);

  const loadMenus = async () => {
    try {
      setLoading(true);
      const [dailyData, menuData] = await Promise.all([
        menuApi.dailyList(date, mealType),
        menuApi.list(),
      ]);
      setDailyMenus(dailyData);
      setAllMenus(menuData);
    } catch (err) {
      message.error('加载菜单失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category) => {
    const map = { '荤菜套餐': 'red', '素菜套餐': 'green', '面食': 'orange', '小吃': 'purple', '粥品套餐': 'cyan' };
    return map[category] || 'default';
  };

  return (
    <div>
      <div className="page-header">
        <h2>🍽 菜单浏览</h2>
        <p>查看每日菜品及库存</p>
      </div>

      <div className="card-container">
        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <DatePicker
              value={dayjs(date)}
              onChange={(_, ds) => setDate(ds)}
              allowClear={false}
            />
          </Col>
          <Col>
            <Segmented
              value={mealType}
              onChange={setMealType}
              options={[
                { label: '🍽 午餐', value: 'lunch' },
                { label: '🌙 晚餐', value: 'dinner' },
              ]}
            />
          </Col>
        </Row>

        {loading ? (
          <Spin style={{ display: 'block', margin: '60px auto' }} />
        ) : dailyMenus.length === 0 ? (
          <Empty description="该日期暂无菜品" />
        ) : (
          <Row gutter={[16, 16]}>
            {dailyMenus.map((dm) => {
              const menu = allMenus.find(m => m.id === dm.menu_id) || dm.menu || {};
              const stockClass = dm.stock <= 0 ? 'out' : dm.stock < 10 ? 'low' : '';
              const stockText = dm.stock <= 0 ? '已售罄' : `剩余 ${dm.stock} 份`;
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={dm.id}>
                  <Badge.Ribbon
                    text={menu.category || ''}
                    color={getCategoryColor(menu.category)}
                  >
                    <div className="menu-card" style={{ padding: '24px 16px 16px' }}>
                      <div className="menu-name">{menu.name || dm.menu_name}</div>
                      <div className="menu-price">¥{menu.price || 0}</div>
                      <div className="menu-category">{menu.description}</div>
                      <div className={`menu-stock ${stockClass}`}>
                        {stockText}
                      </div>
                    </div>
                  </Badge.Ribbon>
                </Col>
              );
            })}
          </Row>
        )}
      </div>
    </div>
  );
}
