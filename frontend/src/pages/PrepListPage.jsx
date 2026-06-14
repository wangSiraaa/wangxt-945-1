import React, { useState, useEffect, useCallback } from 'react';
import {
  DatePicker, Segmented, Table, Card, Row, Col, Statistic, Tag, Spin,
  message, Empty, Tabs, Tooltip, Badge, Select
} from 'antd';
import {
  CoffeeOutlined, ShoppingCartOutlined, TeamOutlined, DollarOutlined,
  AlertOutlined, SwapOutlined, ClockCircleOutlined, WarningOutlined
} from '@ant-design/icons';
import { prepApi, canteenWindowApi, deliveryFloorApi, menuIngredientApi } from '../api';
import dayjs from 'dayjs';

const mealLabel = { lunch: '午餐', dinner: '晚餐' };
const mealColor = { lunch: 'orange', dinner: 'purple' };

const changeTypeMap = {
  create: { label: '新增', color: 'green' },
  create_pending: { label: '新增待审', color: 'blue' },
  cancel: { label: '取消', color: 'red' },
  cancel_pending: { label: '取消待审', color: 'volcano' },
  substitute: { label: '替换', color: 'gold' },
  approve: { label: '审批通过', color: 'cyan' },
  verify: { label: '核销', color: 'geekblue' },
  supplement: { label: '补改单', color: 'purple' },
};

export default function PrepListPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [mealType, setMealType] = useState('lunch');
  const [canteenId, setCanteenId] = useState('');
  const [classicData, setClassicData] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [diffLogs, setDiffLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('classic');

  const loadClassic = async () => {
    try {
      setLoading(true);
      const result = await prepApi.list(date, mealType);
      setClassicData(result);
    } catch (err) {
      message.error('加载备餐清单失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDiff = async () => {
    try {
      setLoading(true);
      const params = { date: date, meal_type: mealType };
      if (canteenId) params.canteen_id = canteenId;
      const result = await prepApi.diff(params);
      setDiffData(result);
    } catch (err) {
      message.error('加载备餐差异失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'classic') loadClassic();
    else loadDiff();
  }, [date, mealType, canteenId, activeTab]);

  const itemColumns = [
    { title: '菜品名称', dataIndex: 'menu_name', key: 'name' },
    { title: '单价', dataIndex: 'price', key: 'price', align: 'right', render: v => `¥${v}` },
    {
      title: '预订数量', dataIndex: 'quantity', key: 'qty', align: 'center',
      render: v => <span style={{ fontWeight: 700, fontSize: 16, color: '#1677ff' }}>{v}</span>,
    },
    {
      title: '餐次', dataIndex: 'meal_type', key: 'meal',
      render: v => <Tag color={mealColor[v]}>{mealLabel[v]}</Tag>,
    },
    {
      title: '小计', key: 'subtotal', align: 'right',
      render: (_, r) => <span style={{ fontWeight: 600 }}>¥{(r.price * r.quantity).toFixed(2)}</span>,
    },
  ];

  const deptColumns = [
    { title: '部门', dataIndex: 'department_name', key: 'dept' },
    { title: '订单数', dataIndex: 'order_count', key: 'count', align: 'center' },
    { title: '金额', dataIndex: 'total_amount', key: 'amount', align: 'right', render: v => `¥${v.toFixed(2)}` },
  ];

  const windowColumns = [
    { title: '窗口名称', dataIndex: 'window_name', key: 'wname' },
    { title: '窗口编号', dataIndex: 'window_code', key: 'wcode', width: 100 },
    {
      title: '已确认数量', dataIndex: 'confirmed_quantity', key: 'cq', align: 'center',
      render: v => <span style={{ fontWeight: 700, color: '#1677ff' }}>{v}</span>,
    },
    {
      title: '待审批数量', dataIndex: 'pending_quantity', key: 'pq', align: 'center',
      render: v => <span style={{ color: '#fa8c16' }}>{v}</span>,
    },
    {
      title: '总数量', key: 'total', align: 'center',
      render: (_, r) => <span style={{ fontWeight: 700 }}>{(r.confirmed_quantity || 0) + (r.pending_quantity || 0)}</span>,
    },
  ];

  const ingredientColumns = [
    { title: '原料名称', dataIndex: 'ingredient_name', key: 'iname' },
    {
      title: '单位', dataIndex: 'unit', key: 'unit', width: 60,
      render: v => v || '份',
    },
    {
      title: '已确认用量', dataIndex: 'confirmed_quantity', key: 'cq', align: 'right',
      render: v => <span style={{ fontWeight: 600, color: '#1677ff' }}>{v}</span>,
    },
    {
      title: '待审批用量', dataIndex: 'pending_quantity', key: 'pq', align: 'right',
      render: v => <span style={{ color: '#fa8c16' }}>{v}</span>,
    },
    {
      title: '关联菜品', dataIndex: 'menu_names', key: 'mn',
      render: v => (v || []).map(n => <Tag key={n} style={{ marginBottom: 2 }}>{n}</Tag>),
    },
  ];

  const allergenColumns = [
    { title: '过敏原', dataIndex: 'allergen_name', key: 'aname' },
    {
      title: '涉及菜品', dataIndex: 'menu_names', key: 'mn',
      render: v => (v || []).map(n => <Tag key={n} color="red" style={{ marginBottom: 2 }}>{n}</Tag>),
    },
    {
      title: '已确认受影响人数', dataIndex: 'confirmed_quantity', key: 'cq', align: 'center',
      render: v => <span style={{ fontWeight: 700, color: '#cf1322' }}>{v}</span>,
    },
    {
      title: '待审批受影响人数', dataIndex: 'pending_quantity', key: 'pq', align: 'center',
      render: v => <span style={{ color: '#fa8c16' }}>{v}</span>,
    },
  ];

  const floorColumns = [
    { title: '配送楼层', dataIndex: 'floor_name', key: 'fname' },
    {
      title: '楼层编号', dataIndex: 'floor_code', key: 'fcode', width: 80,
    },
    {
      title: '已确认份数', dataIndex: 'confirmed_quantity', key: 'cq', align: 'center',
      render: v => <span style={{ fontWeight: 700, color: '#1677ff' }}>{v}</span>,
    },
    {
      title: '待审批份数', dataIndex: 'pending_quantity', key: 'pq', align: 'center',
      render: v => <span style={{ color: '#fa8c16' }}>{v}</span>,
    },
    {
      title: '总份数', key: 'total', align: 'center',
      render: (_, r) => <span style={{ fontWeight: 700 }}>{(r.confirmed_quantity || 0) + (r.pending_quantity || 0)}</span>,
    },
  ];

  const logColumns = [
    {
      title: '时间', dataIndex: 'created_at', key: 'time', width: 170,
      render: v => dayjs(v).format('MM-DD HH:mm:ss'),
    },
    {
      title: '订单号', dataIndex: 'order_no', key: 'ono', width: 140,
    },
    {
      title: '变更类型', dataIndex: 'change_type', key: 'ct', width: 100,
      render: v => {
        const m = changeTypeMap[v] || { label: v, color: 'default' };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '变更前', dataIndex: 'before_status', key: 'bs', width: 110,
      render: v => v || '-',
    },
    {
      title: '变更后', dataIndex: 'after_status', key: 'as', width: 110,
    },
    {
      title: '金额变动', dataIndex: 'amount_diff', key: 'ad', width: 100, align: 'right',
      render: v => v != null ? <span style={{ color: v >= 0 ? '#389e0d' : '#cf1322', fontWeight: 600 }}>
        {v >= 0 ? '+' : ''}¥{v.toFixed(2)}
      </span> : '-',
    },
    {
      title: '截单前', dataIndex: 'is_before_cutoff', key: 'bc', width: 80, align: 'center',
      render: v => v === 1 ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>,
    },
    {
      title: '原因', dataIndex: 'reason', key: 'reason',
      render: v => <Tooltip title={v}><span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || '-'}</span></Tooltip>,
    },
  ];

  const diffSummary = diffData ? {
    windows: diffData.by_window?.length || 0,
    ingredients: diffData.by_ingredient?.length || 0,
    allergens: diffData.by_allergen?.length || 0,
    floors: diffData.by_floor?.length || 0,
    pendingOrders: diffData.pending_count || 0,
  } : null;

  return (
    <div>
      <div className="page-header">
        <h2><CoffeeOutlined /> 动态备餐</h2>
        <p>按食堂窗口、菜品原料、过敏原和配送楼层拆开备餐差异，追踪截单前后变化</p>
      </div>

      <div className="card-container">
        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <DatePicker value={dayjs(date)} onChange={(_, ds) => setDate(ds)} allowClear={false} />
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
          <Col>
            <Select
              placeholder="全部食堂"
              allowClear
              style={{ width: 160 }}
              value={canteenId || undefined}
              onChange={v => setCanteenId(v || '')}
              options={[
                { label: '全部食堂', value: '' },
                { label: '第一食堂', value: '1' },
                { label: '第二食堂', value: '2' },
              ]}
            />
          </Col>
        </Row>

        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: 'classic',
            label: '📋 备餐汇总',
            children: loading ? <Spin style={{ display: 'block', margin: '60px auto' }} /> : !classicData ? <Empty /> : (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                  <Col xs={24} sm={8}>
                    <div className="stat-card">
                      <Statistic title="总订单数" value={classicData.total_orders}
                        prefix={<ShoppingCartOutlined style={{ color: '#1677ff' }} />} />
                    </div>
                  </Col>
                  <Col xs={24} sm={8}>
                    <div className="stat-card">
                      <Statistic title="涉及部门" value={classicData.department_summary?.length || 0}
                        prefix={<TeamOutlined style={{ color: '#52c41a' }} />} suffix="个" />
                    </div>
                  </Col>
                  <Col xs={24} sm={8}>
                    <div className="stat-card">
                      <Statistic title="总金额" value={classicData.total_amount}
                        prefix={<DollarOutlined style={{ color: '#fa8c16' }} />} suffix="元" />
                    </div>
                  </Col>
                </Row>
                <h3 style={{ marginBottom: 12 }}>菜品备餐汇总</h3>
                <Table columns={itemColumns} dataSource={classicData.items}
                  rowKey={r => `${r.menu_id}_${r.meal_type}`} pagination={false} size="middle" style={{ marginBottom: 24 }} />
                <h3 style={{ marginBottom: 12 }}>部门订餐汇总</h3>
                <Table columns={deptColumns} dataSource={classicData.department_summary}
                  rowKey="department_id" pagination={false} size="middle" />
              </>
            ),
          },
          {
            key: 'window',
            label: <span><AlertOutlined /> 按窗口</span>,
            children: loading ? <Spin style={{ display: 'block', margin: '60px auto' }} /> : !diffData ? <Empty description="暂无数据" /> : (
              <>
                {diffSummary && (
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col span={6}>
                      <Statistic title="窗口数" value={diffSummary.windows} prefix={<AlertOutlined />} />
                    </Col>
                    <Col span={6}>
                      <Statistic title="待审批订单" value={diffSummary.pendingOrders}
                        prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
                        valueStyle={{ color: '#fa8c16' }} />
                    </Col>
                  </Row>
                )}
                <Table columns={windowColumns} dataSource={diffData.by_window || []}
                  rowKey="window_id" pagination={false} size="middle" />
              </>
            ),
          },
          {
            key: 'ingredient',
            label: <span><ShoppingCartOutlined /> 按原料</span>,
            children: loading ? <Spin style={{ display: 'block', margin: '60px auto' }} /> : !diffData ? <Empty description="暂无数据" /> : (
              <Table columns={ingredientColumns} dataSource={diffData.by_ingredient || []}
                rowKey="ingredient_id" pagination={false} size="middle" />
            ),
          },
          {
            key: 'allergen',
            label: <span><WarningOutlined /> 过敏原</span>,
            children: loading ? <Spin style={{ display: 'block', margin: '60px auto' }} /> : !diffData ? <Empty description="暂无数据" /> : (
              <Table columns={allergenColumns} dataSource={diffData.by_allergen || []}
                rowKey="allergen" pagination={false} size="middle" />
            ),
          },
          {
            key: 'floor',
            label: <span><TeamOutlined /> 按楼层</span>,
            children: loading ? <Spin style={{ display: 'block', margin: '60px auto' }} /> : !diffData ? <Empty description="暂无数据" /> : (
              <Table columns={floorColumns} dataSource={diffData.by_floor || []}
                rowKey="floor_id" pagination={false} size="middle" />
            ),
          },
          {
            key: 'logs',
            label: <span><SwapOutlined /> 变更流水</span>,
            children: loading ? <Spin style={{ display: 'block', margin: '60px auto' }} /> : !diffData?.change_logs?.length ? <Empty description="暂无变更记录" /> : (
              <Table columns={logColumns} dataSource={diffData.change_logs || []}
                rowKey="id" pagination={{ pageSize: 20 }} size="middle"
                scroll={{ x: 900 }} />
            ),
          },
        ]} />
      </div>
    </div>
  );
}
