import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  DatePicker,
  Select,
  Button,
  Table,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Tooltip,
  Divider,
  Descriptions,
} from 'antd';
import dayjs from 'dayjs';
import {
  departmentApi,
  reconciliationApi,
  settlementApi,
  employeeApi,
  budgetApi,
  settingsApi,
} from '../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const mealTypeMap = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState('diff');
  const [departmentId, setDepartmentId] = useState();
  const [departments, setDepartments] = useState([]);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [diffData, setDiffData] = useState({ summary: {}, items: [] });
  const [settlements, setSettlements] = useState([]);
  const [budgetRecords, setBudgetRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [loading, setLoading] = useState(false);
  const [settlementDetail, setSettlementDetail] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [recalculateLoading, setRecalculateLoading] = useState(false);

  useEffect(() => {
    departmentApi.list().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'diff') {
      loadDiffData();
    } else if (activeTab === 'settlement') {
      loadSettlements();
    } else if (activeTab === 'budget') {
      loadBudgetRecords();
    }
  }, [activeTab, departmentId, dateRange, selectedMonth]);

  const loadDiffData = () => {
    setLoading(true);
    const params = {};
    if (departmentId) params.department_id = departmentId;
    if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD');
    if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD');
    reconciliationApi
      .diff(params)
      .then(setDiffData)
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  };

  const loadSettlements = () => {
    setLoading(true);
    const params = {};
    if (departmentId) params.department_id = departmentId;
    settlementApi
      .list(params)
      .then(setSettlements)
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  };

  const loadBudgetRecords = () => {
    setLoading(true);
    const params = { month: selectedMonth.format('YYYY-MM') };
    if (departmentId) params.department_id = departmentId;
    budgetApi
      .list(params)
      .then(setBudgetRecords)
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  };

  const viewSettlementDetail = (record) => {
    setLoading(true);
    settlementApi
      .get(record.id)
      .then((data) => {
        setSettlementDetail(data);
        setDetailModalVisible(true);
      })
      .catch((err) => message.error(err.message))
      .finally(() => setLoading(false));
  };

  const handleRecalculate = (record) => {
    setRecalculateLoading(true);
    settlementApi
      .recalculate(record.id)
      .then((data) => {
        message.success(
          `结算重算完成，差异金额：${data.diff_amount >= 0 ? '+' : ''}¥${data.diff_amount.toFixed(2)}`
        );
        setSettlementDetail(data);
        loadSettlements();
      })
      .catch((err) => message.error(err.message))
      .finally(() => setRecalculateLoading(false));
  };

  const confirmSettlement = (record) => {
    Modal.confirm({
      title: '确认结算',
      content: `确定确认结算单 ${record.settlement_no} 吗？`,
      onOk: () => {
        setLoading(true);
        settlementApi
          .confirm(record.id)
          .then(() => {
            message.success('结算已确认');
            loadSettlements();
          })
          .catch((err) => message.error(err.message))
          .finally(() => setLoading(false));
      },
    });
  };

  const diffColumns = [
    {
      title: '订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 160,
    },
    {
      title: '员工',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '日期',
      dataIndex: 'menu_date',
      key: 'menu_date',
      width: 110,
    },
    {
      title: '餐别',
      dataIndex: 'meal_type',
      key: 'meal_type',
      width: 70,
      render: (t) => mealTypeMap[t] || t,
    },
    {
      title: '订单金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 100,
      render: (v) => `¥${v?.toFixed?.(2) || v}`,
    },
    {
      title: '补贴差异',
      dataIndex: 'subsidy_diff',
      key: 'subsidy_diff',
      width: 100,
      render: (v) => (
        <span style={{ color: v !== 0 ? '#ff4d4f' : undefined }}>
          {v >= 0 ? '+' : ''}¥{v?.toFixed?.(2) || v}
        </span>
      ),
    },
    {
      title: '自付差异',
      dataIndex: 'personal_diff',
      key: 'personal_diff',
      width: 100,
      render: (v) => (
        <span style={{ color: v !== 0 ? '#ff4d4f' : undefined }}>
          {v >= 0 ? '+' : ''}¥{v?.toFixed?.(2) || v}
        </span>
      ),
    },
    {
      title: '取消费',
      dataIndex: 'cancel_fee',
      key: 'cancel_fee',
      width: 90,
      render: (v) => (v > 0 ? <span style={{ color: '#ff4d4f' }}>¥{v?.toFixed?.(2)}</span> : '-'),
    },
    {
      title: '总差异',
      dataIndex: 'total_diff',
      key: 'total_diff',
      width: 100,
      render: (v) => (
        <strong style={{ color: v !== 0 ? '#ff4d4f' : '#52c41a' }}>
          {v >= 0 ? '+' : ''}¥{v?.toFixed?.(2) || v}
        </strong>
      ),
    },
    {
      title: '异常类型',
      key: 'abnormal_types',
      render: (_, r) => (
        <Space>
          {r.abnormal_types?.map((type, idx) => (
            <Tag key={idx} color="red">
              {type}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  const settlementColumns = [
    {
      title: '结算单号',
      dataIndex: 'settlement_no',
      key: 'settlement_no',
      width: 170,
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '结算周期',
      key: 'period',
      width: 220,
      render: (_, r) => `${r.start_date} 至 ${r.end_date}`,
    },
    {
      title: '订单数',
      dataIndex: 'order_count',
      key: 'order_count',
      width: 80,
    },
    {
      title: '结算金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 110,
      render: (v) => <strong>¥{v?.toFixed?.(2) || v}</strong>,
    },
    {
      title: '其中补贴',
      dataIndex: 'total_subsidy',
      key: 'total_subsidy',
      width: 110,
      render: (v) => (v != null ? `¥${v?.toFixed?.(2) || v}` : '-'),
    },
    {
      title: '其中自费',
      dataIndex: 'total_personal',
      key: 'total_personal',
      width: 110,
      render: (v) => (v != null ? `¥${v?.toFixed?.(2) || v}` : '-'),
    },
    {
      title: '异常费用',
      dataIndex: 'total_abnormal_fee',
      key: 'total_abnormal_fee',
      width: 100,
      render: (v) =>
        v > 0 ? <span style={{ color: '#ff4d4f' }}>¥{v?.toFixed?.(2)}</span> : '-',
    },
    {
      title: '差异金额',
      dataIndex: 'diff_amount',
      key: 'diff_amount',
      width: 100,
      render: (v) =>
        v != null && v !== 0 ? (
          <Tag color={v > 0 ? 'red' : 'orange'}>{v > 0 ? '+' : ''}¥{v?.toFixed?.(2)}</Tag>
        ) : (
          '-'
        ),
    },
    {
      title: '重算次数',
      dataIndex: 'recalculate_count',
      key: 'recalculate_count',
      width: 80,
      render: (v) => (v || 0),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s) => {
        const map = {
          draft: { color: 'default', text: '草稿' },
          settled: { color: 'success', text: '已结算' },
        };
        const cfg = map[s] || { color: 'default', text: s };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => viewSettlementDetail(r)}>
            详情
          </Button>
          <Button
            size="small"
            onClick={() => handleRecalculate(r)}
            loading={recalculateLoading}
          >
            重算
          </Button>
          {r.status !== 'settled' && (
            <Button size="small" type="primary" onClick={() => confirmSettlement(r)}>
              确认结算
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const budgetColumns = [
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '部门编码',
      dataIndex: 'department_code',
      key: 'department_code',
      width: 100,
    },
    {
      title: '预算月份',
      dataIndex: 'budget_month',
      key: 'budget_month',
      width: 110,
    },
    {
      title: '总预算',
      dataIndex: 'total_budget',
      key: 'total_budget',
      width: 120,
      render: (v) => `¥${v?.toFixed?.(2) || v}`,
    },
    {
      title: '已使用',
      dataIndex: 'used_amount',
      key: 'used_amount',
      width: 120,
      render: (v) => `¥${v?.toFixed?.(2) || v}`,
    },
    {
      title: '审批占用',
      dataIndex: 'reserved_amount',
      key: 'reserved_amount',
      width: 120,
      render: (v) => (v > 0 ? <Tag color="orange">¥{v?.toFixed?.(2)}</Tag> : '-'),
    },
    {
      title: '剩余预算',
      dataIndex: 'remaining',
      key: 'remaining',
      width: 120,
      render: (v, r) => {
        const color = v < 0 ? '#ff4d4f' : v < r.total_budget * 0.2 ? '#faad14' : '#52c41a';
        return <span style={{ color, fontWeight: 'bold' }}>¥{v?.toFixed?.(2) || v}</span>;
      },
    },
    {
      title: '使用率',
      key: 'usage',
      width: 150,
      render: (_, r) => (
        <div>
          <div
            style={{
              width: `${Math.min(100, r.usage_percentage)}%`,
              height: 8,
              background:
                r.usage_percentage > 100
                  ? '#ff4d4f'
                  : r.usage_percentage > 80
                  ? '#faad14'
                  : '#52c41a',
              borderRadius: 4,
              display: 'inline-block',
            }}
          />
          <span style={{ marginLeft: 8 }}>{r.usage_percentage}%</span>
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, r) => {
        if (r.usage_percentage > 100) return <Tag color="red">超预算</Tag>;
        if (r.usage_percentage > 80) return <Tag color="orange">预警</Tag>;
        return <Tag color="green">正常</Tag>;
      },
    },
  ];

  const summary = diffData.summary || {};

  return (
    <div>
      <Card title="财务对账" bordered={false}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            value={departmentId}
            onChange={setDepartmentId}
            style={{ width: 180 }}
            placeholder="选择部门"
            allowClear
          >
            {departments.map((d) => (
              <Option key={d.id} value={d.id}>
                {d.name}
              </Option>
            ))}
          </Select>
          {activeTab === 'budget' ? (
            <DatePicker.MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          ) : (
            <RangePicker value={dateRange} onChange={setDateRange} />
          )}
          <Button
            type="primary"
            onClick={() => {
              if (activeTab === 'diff') loadDiffData();
              else if (activeTab === 'settlement') loadSettlements();
              else if (activeTab === 'budget') loadBudgetRecords();
            }}
          >
            查询
          </Button>
        </Space>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="对账差异" key="diff">
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card>
                  <Statistic title="订单总数" value={summary.order_count || 0} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="异常订单数"
                    value={summary.abnormal_count || 0}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="系统计算金额"
                    value={summary.total_system_amount || 0}
                    precision={2}
                    prefix="¥"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="差异总金额"
                    value={summary.total_diff || 0}
                    precision={2}
                    prefix="¥"
                    valueStyle={{
                      color: (summary.total_diff || 0) !== 0 ? '#ff4d4f' : '#52c41a',
                    }}
                  />
                </Card>
              </Col>
            </Row>
            <Table
              columns={diffColumns}
              dataSource={diffData.items || []}
              rowKey="order_id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1300 }}
            />
          </Tabs.TabPane>

          <Tabs.TabPane tab="结算单管理" key="settlement">
            <Table
              columns={settlementColumns}
              dataSource={settlements}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1400 }}
            />
          </Tabs.TabPane>

          <Tabs.TabPane tab="预算执行" key="budget">
            <Table
              columns={budgetColumns}
              dataSource={budgetRecords}
              rowKey={(r) => `${r.department_id}_${r.budget_month}`}
              loading={loading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1100 }}
            />
          </Tabs.TabPane>
        </Tabs>
      </Card>

      <Modal
        title="结算单详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="recalc"
            onClick={() => settlementDetail && handleRecalculate(settlementDetail)}
            loading={recalculateLoading}
          >
            重算
          </Button>,
          settlementDetail?.status !== 'settled' && (
            <Button
              key="confirm"
              type="primary"
              onClick={() => {
                confirmSettlement(settlementDetail);
                setDetailModalVisible(false);
              }}
            >
              确认结算
            </Button>
          ),
        ]}
      >
        {settlementDetail && (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="结算单号">
                {settlementDetail.settlement_no}
              </Descriptions.Item>
              <Descriptions.Item label="部门">
                {settlementDetail.department_name}
              </Descriptions.Item>
              <Descriptions.Item label="结算周期">
                {settlementDetail.start_date} 至 {settlementDetail.end_date}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={settlementDetail.status === 'settled' ? 'green' : 'default'}>
                  {settlementDetail.status === 'settled' ? '已结算' : '草稿'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="订单数">
                {settlementDetail.order_count || settlementDetail.items?.length || 0}
              </Descriptions.Item>
              <Descriptions.Item label="重算次数">
                {settlementDetail.recalculate_count || 0}
              </Descriptions.Item>
              <Descriptions.Item label="结算总金额">
                <strong style={{ fontSize: 16, color: '#1677ff' }}>
                  ¥{settlementDetail.total_amount?.toFixed?.(2)}
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="差异金额">
                {settlementDetail.diff_amount != null && settlementDetail.diff_amount !== 0 ? (
                  <Tag color={settlementDetail.diff_amount > 0 ? 'red' : 'orange'}>
                    {settlementDetail.diff_amount > 0 ? '+' : ''}¥
                    {settlementDetail.diff_amount?.toFixed?.(2)}
                  </Tag>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="补贴合计">
                ¥{(settlementDetail.total_subsidy || 0)?.toFixed?.(2)}
              </Descriptions.Item>
              <Descriptions.Item label="自费合计">
                ¥{(settlementDetail.total_personal || 0)?.toFixed?.(2)}
              </Descriptions.Item>
              <Descriptions.Item label="取消费合计">
                ¥{(settlementDetail.total_cancel_fee || 0)?.toFixed?.(2)}
              </Descriptions.Item>
              <Descriptions.Item label="异常费合计">
                ¥{(settlementDetail.total_abnormal_fee || 0)?.toFixed?.(2)}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">订单明细</Divider>
            <Table
              size="small"
              dataSource={settlementDetail.items || []}
              rowKey="id"
              pagination={false}
              columns={[
                { title: '员工', dataIndex: 'employee_name', key: 'employee_name' },
                { title: '工号', dataIndex: 'employee_no', key: 'employee_no' },
                { title: '订单号', dataIndex: 'order_no', key: 'order_no' },
                { title: '日期', dataIndex: 'menu_date', key: 'menu_date' },
                {
                  title: '餐别',
                  dataIndex: 'meal_type',
                  key: 'meal_type',
                  render: (t) => mealTypeMap[t] || t,
                },
                {
                  title: '订单金额',
                  dataIndex: 'order_amount',
                  key: 'order_amount',
                  render: (v) => `¥${v?.toFixed?.(2) || v}`,
                },
                {
                  title: '补贴',
                  dataIndex: 'subsidy_amount',
                  key: 'subsidy_amount',
                  render: (v) => (v != null ? `¥${v?.toFixed?.(2)}` : '-'),
                },
                {
                  title: '自费',
                  dataIndex: 'personal_pay',
                  key: 'personal_pay',
                  render: (v) => (v != null ? `¥${v?.toFixed?.(2)}` : '-'),
                },
                {
                  title: '取消费',
                  dataIndex: 'cancel_fee',
                  key: 'cancel_fee',
                  render: (v) => (v > 0 ? <span style={{ color: '#ff4d4f' }}>¥{v?.toFixed?.(2)}</span> : '-'),
                },
                {
                  title: '合计',
                  dataIndex: 'total',
                  key: 'total',
                  render: (v) => <strong>¥{v?.toFixed?.(2)}</strong>,
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
