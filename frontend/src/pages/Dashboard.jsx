import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Spin, message } from 'antd';
import {
  ShoppingCartOutlined,
  CoffeeOutlined,
  AuditOutlined,
  DollarOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { dashboardApi, approvalApi, settingsApi } from '../api';
import dayjs from 'dayjs';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [settings, setSettings] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, approvalsData, settingsData] = await Promise.all([
        dashboardApi.stats(),
        approvalApi.list({ status: 'pending' }),
        settingsApi.list(),
      ]);
      setStats(statsData);
      setPendingCount(approvalsData.length);
      setSettings(settingsData);
    } catch (err) {
      message.error('加载数据失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />;

  const cutoffLunch = settings.find(s => s.key === 'cutoff_time_lunch')?.value || '10:00';
  const cutoffDinner = settings.find(s => s.key === 'cutoff_time_dinner')?.value || '16:00';

  const deptColumns = [
    { title: '部门', dataIndex: 'department_name', key: 'dept' },
    { title: '订单数', dataIndex: 'order_count', key: 'count', align: 'center' },
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
        <h2>📊 工作台</h2>
        <p>今日订餐总览 · {dayjs().format('YYYY年MM月DD日')}</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <div className="stat-card">
            <Statistic
              title="今日总订单"
              value={stats?.today_total_orders || 0}
              prefix={<ShoppingCartOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="stat-card">
            <Statistic
              title="午餐订单"
              value={stats?.lunch_orders || 0}
              prefix={<CoffeeOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
            <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>
              截单时间: {cutoffLunch}
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="stat-card">
            <Statistic
              title="晚餐订单"
              value={stats?.dinner_orders || 0}
              prefix={<CoffeeOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>
              截单时间: {cutoffDinner}
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div className="stat-card">
            <Statistic
              title="待审批"
              value={pendingCount}
              prefix={<AuditOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: pendingCount > 0 ? '#f5222d' : '#52c41a' }}
            />
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} lg={12}>
          <div className="stat-card">
            <Statistic
              title="今日总金额"
              value={stats?.today_total_amount || 0}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              suffix="元"
              valueStyle={{ color: '#52c41a' }}
            />
          </div>
        </Col>
        <Col xs={24} sm={12} lg={12}>
          <div className="stat-card">
            <Statistic
              title="涉及部门"
              value={stats?.department_stats?.length || 0}
              prefix={<TeamOutlined style={{ color: '#13c2c2' }} />}
              suffix="个"
              valueStyle={{ color: '#13c2c2' }}
            />
          </div>
        </Col>
      </Row>

      <div className="card-container" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 16 }}>各部门订餐统计</h3>
        <Table
          columns={deptColumns}
          dataSource={stats?.department_stats || []}
          rowKey="department_id"
          pagination={false}
          size="middle"
        />
      </div>
    </div>
  );
}
