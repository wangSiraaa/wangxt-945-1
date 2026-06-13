import React, { useState, useEffect } from 'react';
import { Table, Tag, Progress, Card, Row, Col, DatePicker, Select, Spin, message } from 'antd';
import { WalletOutlined, AlertOutlined } from '@ant-design/icons';
import { budgetApi, departmentApi } from '../api';
import dayjs from 'dayjs';

export default function BudgetPage() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [departments, setDepartments] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (month) loadBudgets();
  }, [month]);

  const loadDepartments = async () => {
    try {
      const data = await departmentApi.list();
      setDepartments(data);
    } catch (err) {
      message.error('加载部门失败');
    }
  };

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const data = await budgetApi.list({ month });
      setBudgets(data);
    } catch (err) {
      message.error('加载预算数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (pct) => {
    const v = parseFloat(pct);
    if (v >= 90) return '#f5222d';
    if (v >= 70) return '#faad14';
    return '#52c41a';
  };

  const getStatusText = (pct) => {
    const v = parseFloat(pct);
    if (v >= 90) return '严重超支风险';
    if (v >= 70) return '接近预算';
    return '预算正常';
  };

  const columns = [
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'dept',
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.department_code}</div>
        </div>
      ),
    },
    {
      title: '月度预算',
      dataIndex: 'total_budget',
      key: 'budget',
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>¥{v?.toLocaleString()}</span>,
    },
    {
      title: '已使用',
      dataIndex: 'used_amount',
      key: 'used',
      align: 'right',
      render: (v) => `¥${v?.toLocaleString()}`,
    },
    {
      title: '待审批占用',
      dataIndex: 'reserved_amount',
      key: 'reserved',
      align: 'right',
      render: (v) => v > 0 ? <span style={{ color: '#fa8c16' }}>¥{v.toLocaleString()}</span> : <span style={{ color: '#d9d9d9' }}>¥0</span>,
    },
    {
      title: '剩余',
      dataIndex: 'remaining',
      key: 'remain',
      align: 'right',
      render: (v) => {
        const color = v < 0 ? '#f5222d' : '#52c41a';
        return <span style={{ color, fontWeight: 600 }}>¥{v?.toLocaleString()}</span>;
      },
    },
    {
      title: '使用率',
      dataIndex: 'usage_percentage',
      key: 'usage',
      width: 200,
      render: (pct) => {
        const v = parseFloat(pct);
        return (
          <div>
            <Progress
              percent={Math.min(v, 100)}
              strokeColor={getStatusColor(pct)}
              size="small"
              format={() => `${pct}%`}
            />
            <div style={{ fontSize: 12, color: getStatusColor(pct), marginTop: 2 }}>
              {getStatusText(pct)}
            </div>
          </div>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      render: (_, r) => {
        const v = parseFloat(r.usage_percentage);
        if (v >= 90) return <Tag color="red" icon={<AlertOutlined />}>超支风险</Tag>;
        if (v >= 70) return <Tag color="orange">需关注</Tag>;
        return <Tag color="green">正常</Tag>;
      },
    },
  ];

  const totalBudget = budgets.reduce((s, b) => s + b.total_budget, 0);
  const totalUsed = budgets.reduce((s, b) => s + b.used_amount, 0);
  const totalReserved = budgets.reduce((s, b) => s + b.reserved_amount, 0);
  const totalRemaining = budgets.reduce((s, b) => s + b.remaining, 0);
  const alertCount = budgets.filter(b => parseFloat(b.usage_percentage) >= 70).length;

  return (
    <div>
      <div className="page-header">
        <h2><WalletOutlined /> 预算监控</h2>
        <p>各部门月度订餐预算使用情况</p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={6}>
          <div className="stat-card">
            <div className="stat-label">总预算</div>
            <div className="stat-value" style={{ color: '#1677ff' }}>¥{totalBudget.toLocaleString()}</div>
          </div>
        </Col>
        <Col xs={24} sm={6}>
          <div className="stat-card">
            <div className="stat-label">已使用</div>
            <div className="stat-value" style={{ color: '#52c41a' }}>¥{totalUsed.toLocaleString()}</div>
          </div>
        </Col>
        <Col xs={24} sm={6}>
          <div className="stat-card">
            <div className="stat-label">审批占用</div>
            <div className="stat-value" style={{ color: '#fa8c16' }}>¥{totalReserved.toLocaleString()}</div>
          </div>
        </Col>
        <Col xs={24} sm={6}>
          <div className="stat-card">
            <div className="stat-label">预警部门</div>
            <div className="stat-value" style={{ color: alertCount > 0 ? '#f5222d' : '#52c41a' }}>{alertCount}</div>
          </div>
        </Col>
      </Row>

      <div className="card-container">
        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <DatePicker
              picker="month"
              value={dayjs(month + '-01')}
              onChange={(_, ds) => setMonth(ds.substring(0, 7))}
              allowClear={false}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={budgets}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </div>
    </div>
  );
}
