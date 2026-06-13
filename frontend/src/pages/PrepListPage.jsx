import React, { useState, useEffect } from 'react';
import { DatePicker, Segmented, Table, Card, Row, Col, Statistic, Tag, Spin, message, Empty } from 'antd';
import { CoffeeOutlined, ShoppingCartOutlined, TeamOutlined, DollarOutlined } from '@ant-design/icons';
import { prepApi } from '../api';
import dayjs from 'dayjs';

export default function PrepListPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [mealType, setMealType] = useState('lunch');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPrepList();
  }, [date, mealType]);

  const loadPrepList = async () => {
    try {
      setLoading(true);
      const result = await prepApi.list(date, mealType);
      setData(result);
    } catch (err) {
      message.error('加载备餐清单失败');
    } finally {
      setLoading(false);
    }
  };

  const itemColumns = [
    {
      title: '菜品名称',
      dataIndex: 'menu_name',
      key: 'name',
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      align: 'right',
      render: (v) => `¥${v}`,
    },
    {
      title: '预订数量',
      dataIndex: 'quantity',
      key: 'qty',
      align: 'center',
      render: (v) => <span style={{ fontWeight: 700, fontSize: 16, color: '#1677ff' }}>{v}</span>,
    },
    {
      title: '餐次',
      dataIndex: 'meal_type',
      key: 'meal',
      render: (v) => <Tag color={v === 'lunch' ? 'orange' : 'purple'}>{v === 'lunch' ? '午餐' : '晚餐'}</Tag>,
    },
    {
      title: '小计',
      key: 'subtotal',
      align: 'right',
      render: (_, r) => <span style={{ fontWeight: 600 }}>¥{(r.price * r.quantity).toFixed(2)}</span>,
    },
  ];

  const deptColumns = [
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'dept',
    },
    {
      title: '订单数',
      dataIndex: 'order_count',
      key: 'count',
      align: 'center',
    },
    {
      title: '金额',
      dataIndex: 'total_amount',
      key: 'amount',
      align: 'right',
      render: (v) => `¥${v.toFixed(2)}`,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2><CoffeeOutlined /> 备餐清单</h2>
        <p>餐厅查看各菜品预订数量及部门汇总</p>
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
        ) : !data ? (
          <Empty />
        ) : (
          <>
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
              <Col xs={24} sm={8}>
                <div className="stat-card">
                  <Statistic
                    title="总订单数"
                    value={data.total_orders}
                    prefix={<ShoppingCartOutlined style={{ color: '#1677ff' }} />}
                  />
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div className="stat-card">
                  <Statistic
                    title="涉及部门"
                    value={data.department_summary?.length || 0}
                    prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
                    suffix="个"
                  />
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div className="stat-card">
                  <Statistic
                    title="总金额"
                    value={data.total_amount}
                    prefix={<DollarOutlined style={{ color: '#fa8c16' }} />}
                    suffix="元"
                  />
                </div>
              </Col>
            </Row>

            <h3 style={{ marginBottom: 12 }}>菜品备餐汇总</h3>
            <Table
              columns={itemColumns}
              dataSource={data.items}
              rowKey={(r) => `${r.menu_id}_${r.meal_type}`}
              pagination={false}
              size="middle"
              style={{ marginBottom: 24 }}
            />

            <h3 style={{ marginBottom: 12 }}>部门订餐汇总</h3>
            <Table
              columns={deptColumns}
              dataSource={data.department_summary}
              rowKey="department_id"
              pagination={false}
              size="middle"
            />
          </>
        )}
      </div>
    </div>
  );
}
