import React, { useState, useEffect } from 'react';
import {
  DatePicker, Table, Card, Row, Col, Statistic, Tag, Spin,
  message, Empty, Tabs, Button, Modal, Select, Tooltip, Descriptions, Space
} from 'antd';
import {
  DollarOutlined, AccountBookOutlined, AuditOutlined,
  RedoOutlined, SwapOutlined, CheckCircleOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { financeLedgerApi, orderChangeLogApi } from '../api';
import dayjs from 'dayjs';

const entryTypeMap = {
  subsidy: { label: '补贴', color: 'blue' },
  personal: { label: '个人自费', color: 'green' },
  budget_use: { label: '预算占用', color: 'orange' },
  project_share: { label: '项目分摊', color: 'purple' },
  overtime_fee: { label: '超时扣费', color: 'red' },
  subsidy_reverse: { label: '补贴冲回', color: 'volcano' },
  personal_reverse: { label: '个人冲回', color: 'lime' },
  budget_release: { label: '预算释放', color: 'cyan' },
  subsidy_adjust: { label: '补贴调整', color: 'geekblue' },
  personal_adjust: { label: '个人调整', color: 'gold' },
};

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

export default function FinanceTracePage() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [ledgerData, setLedgerData] = useState(null);
  const [changeLogs, setChangeLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [activeTab, setActiveTab] = useState('ledger');
  const [orderNoFilter, setOrderNoFilter] = useState('');
  const [entryTypeFilter, setEntryTypeFilter] = useState('');

  const loadLedger = async () => {
    try {
      setLoading(true);
      const params = { month };
      const result = await financeLedgerApi.list(params);
      setLedgerData(result);
    } catch (err) {
      message.error('加载财务分账流水失败');
    } finally {
      setLoading(false);
    }
  };

  const loadChangeLogs = async () => {
    try {
      const params = { month, limit: 100 };
      const result = await orderChangeLogApi.list(params);
      setChangeLogs(result.logs || result || []);
    } catch (err) {
      message.error('加载变更日志失败');
    }
  };

  useEffect(() => {
    loadLedger();
  }, [month]);

  useEffect(() => {
    if (activeTab === 'logs') loadChangeLogs();
  }, [activeTab, month]);

  const handleRecalculate = () => {
    Modal.confirm({
      title: '月底重算确认',
      icon: <ExclamationCircleOutlined />,
      content: `将清除 ${month} 月所有财务分账记录，从订单流水重新推导。此操作不可撤销，是否继续？`,
      okText: '确认重算',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setRecalculating(true);
          await financeLedgerApi.recalculate({ month });
          message.success('月底重算完成');
          loadLedger();
        } catch (err) {
          message.error('月底重算失败: ' + (err.message || '未知错误'));
        } finally {
          setRecalculating(false);
        }
      },
    });
  };

  const getFilteredEntries = () => {
    if (!ledgerData?.entries) return [];
    let filtered = ledgerData.entries;
    if (orderNoFilter) {
      filtered = filtered.filter(e => e.order_no?.includes(orderNoFilter));
    }
    if (entryTypeFilter) {
      filtered = filtered.filter(e => e.entry_type === entryTypeFilter);
    }
    return filtered;
  };

  const ledgerColumns = [
    {
      title: '时间', dataIndex: 'created_at', key: 'time', width: 160,
      render: v => dayjs(v).format('MM-DD HH:mm:ss'),
    },
    {
      title: '订单号', dataIndex: 'order_no', key: 'ono', width: 140,
    },
    {
      title: '分账类型', dataIndex: 'entry_type', key: 'et', width: 110,
      render: v => {
        const m = entryTypeMap[v] || { label: v, color: 'default' };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '金额', dataIndex: 'amount', key: 'amt', width: 110, align: 'right',
      render: v => <span style={{
        fontWeight: 700,
        color: v >= 0 ? '#389e0d' : '#cf1322'
      }}>{v >= 0 ? '+' : ''}¥{Math.abs(v).toFixed(2)}</span>,
    },
    {
      title: '部门', dataIndex: 'department_name', key: 'dept', width: 120,
      render: v => v || '-',
    },
    {
      title: '关联变更', dataIndex: 'source_log_id', key: 'sli', width: 100,
      render: v => v ? <Tag color="blue">有</Tag> : '-',
    },
    {
      title: '备注', dataIndex: 'remark', key: 'remark',
      render: v => <Tooltip title={v}><span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || '-'}</span></Tooltip>,
    },
  ];

  const summaryColumns = [
    {
      title: '分账类型', dataIndex: 'entry_type', key: 'et', width: 130,
      render: v => {
        const m = entryTypeMap[v] || { label: v, color: 'default' };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '笔数', dataIndex: 'count', key: 'cnt', width: 80, align: 'center',
    },
    {
      title: '合计金额', dataIndex: 'total_amount', key: 'ta', width: 130, align: 'right',
      render: v => <span style={{ fontWeight: 700, color: v >= 0 ? '#389e0d' : '#cf1322' }}>
        ¥{Math.abs(v).toFixed(2)}
      </span>,
    },
  ];

  const deptSummaryColumns = [
    {
      title: '部门', dataIndex: 'department_name', key: 'dept',
    },
    {
      title: '补贴', dataIndex: 'subsidy', key: 'sub', align: 'right',
      render: v => v ? <span style={{ color: '#1677ff' }}>¥{v.toFixed(2)}</span> : '-',
    },
    {
      title: '个人自费', dataIndex: 'personal', key: 'per', align: 'right',
      render: v => v ? <span style={{ color: '#389e0d' }}>¥{v.toFixed(2)}</span> : '-',
    },
    {
      title: '预算占用', dataIndex: 'budget_use', key: 'bu', align: 'right',
      render: v => v ? <span style={{ color: '#fa8c16' }}>¥{v.toFixed(2)}</span> : '-',
    },
    {
      title: '项目分摊', dataIndex: 'project_share', key: 'ps', align: 'right',
      render: v => v ? <span style={{ color: '#722ed1' }}>¥{v.toFixed(2)}</span> : '-',
    },
    {
      title: '超时扣费', dataIndex: 'overtime_fee', key: 'of', align: 'right',
      render: v => v ? <span style={{ color: '#cf1322' }}>¥{v.toFixed(2)}</span> : '-',
    },
    {
      title: '合计', dataIndex: 'total', key: 'total', align: 'right',
      render: v => v ? <span style={{ fontWeight: 700 }}>¥{v.toFixed(2)}</span> : '-',
    },
  ];

  const logColumns = [
    {
      title: '时间', dataIndex: 'created_at', key: 'time', width: 160,
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
      title: '变更前', dataIndex: 'before_status', key: 'bs', width: 100,
      render: v => v || '-',
    },
    {
      title: '变更后', dataIndex: 'after_status', key: 'as', width: 110,
    },
    {
      title: '金额变动', dataIndex: 'amount_diff', key: 'ad', width: 110, align: 'right',
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
      render: v => <Tooltip title={v}><span style={{ maxWidth: 180, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || '-'}</span></Tooltip>,
    },
  ];

  const typeSummary = ledgerData?.type_summary || [];
  const deptSummary = ledgerData?.department_summary || [];

  const totalSubsidy = typeSummary.filter(s => s.entry_type === 'subsidy').reduce((a, b) => a + (b.total_amount || 0), 0);
  const totalPersonal = typeSummary.filter(s => s.entry_type === 'personal').reduce((a, b) => a + (b.total_amount || 0), 0);
  const totalBudgetUse = typeSummary.filter(s => s.entry_type === 'budget_use').reduce((a, b) => a + (b.total_amount || 0), 0);
  const totalProjectShare = typeSummary.filter(s => s.entry_type === 'project_share').reduce((a, b) => a + (b.total_amount || 0), 0);
  const totalOvertimeFee = typeSummary.filter(s => s.entry_type === 'overtime_fee').reduce((a, b) => a + (b.total_amount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h2><AccountBookOutlined /> 财务追溯</h2>
        <p>补贴、个人自费、部门预算、项目分摊、超时扣费分开入账，月底重算从流水推导</p>
      </div>

      <div className="card-container">
        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <DatePicker
              picker="month"
              value={dayjs(month + '-01')}
              onChange={(_, ds) => setMonth(ds.substring(0, 7))}
              allowClear={false}
            />
          </Col>
          <Col>
            <Button
              type="primary"
              danger
              icon={<RedoOutlined />}
              loading={recalculating}
              onClick={handleRecalculate}
            >
              月底重算
            </Button>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={8} md={4}>
            <div className="stat-card">
              <Statistic title="补贴入账" value={totalSubsidy} prefix={<DollarOutlined style={{ color: '#1677ff' }} />} suffix="元" valueStyle={{ color: '#1677ff' }} />
            </div>
          </Col>
          <Col xs={24} sm={8} md={4}>
            <div className="stat-card">
              <Statistic title="个人自费" value={totalPersonal} prefix={<DollarOutlined style={{ color: '#389e0d' }} />} suffix="元" valueStyle={{ color: '#389e0d' }} />
            </div>
          </Col>
          <Col xs={24} sm={8} md={4}>
            <div className="stat-card">
              <Statistic title="预算占用" value={totalBudgetUse} prefix={<DollarOutlined style={{ color: '#fa8c16' }} />} suffix="元" valueStyle={{ color: '#fa8c16' }} />
            </div>
          </Col>
          <Col xs={24} sm={8} md={4}>
            <div className="stat-card">
              <Statistic title="项目分摊" value={totalProjectShare} prefix={<DollarOutlined style={{ color: '#722ed1' }} />} suffix="元" valueStyle={{ color: '#722ed1' }} />
            </div>
          </Col>
          <Col xs={24} sm={8} md={4}>
            <div className="stat-card">
              <Statistic title="超时扣费" value={totalOvertimeFee} prefix={<DollarOutlined style={{ color: '#cf1322' }} />} suffix="元" valueStyle={{ color: '#cf1322' }} />
            </div>
          </Col>
          <Col xs={24} sm={8} md={4}>
            <div className="stat-card">
              <Statistic title="分账总笔数" value={ledgerData?.entries?.length || 0} prefix={<AuditOutlined />} suffix="笔" />
            </div>
          </Col>
        </Row>

        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: 'ledger',
            label: <span><AccountBookOutlined /> 分账流水</span>,
            children: (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col>
                    <Select
                      placeholder="分账类型筛选"
                      allowClear
                      style={{ width: 160 }}
                      value={entryTypeFilter || undefined}
                      onChange={v => setEntryTypeFilter(v || '')}
                      options={Object.entries(entryTypeMap).map(([k, v]) => ({ label: v.label, value: k }))}
                    />
                  </Col>
                </Row>
                {loading ? <Spin style={{ display: 'block', margin: '60px auto' }} /> : (
                  <Table
                    columns={ledgerColumns}
                    dataSource={getFilteredEntries()}
                    rowKey={r => `${r.id}_${r.entry_type}`}
                    pagination={{ pageSize: 20 }}
                    size="middle"
                    scroll={{ x: 900 }}
                  />
                )}
              </>
            ),
          },
          {
            key: 'summary',
            label: <span><AuditOutlined /> 类型汇总</span>,
            children: loading ? <Spin style={{ display: 'block', margin: '60px auto' }} /> : (
              <Table
                columns={summaryColumns}
                dataSource={typeSummary}
                rowKey="entry_type"
                pagination={false}
                size="middle"
              />
            ),
          },
          {
            key: 'dept',
            label: <span><DollarOutlined /> 部门汇总</span>,
            children: loading ? <Spin style={{ display: 'block', margin: '60px auto' }} /> : (
              <Table
                columns={deptSummaryColumns}
                dataSource={deptSummary}
                rowKey="department_name"
                pagination={false}
                size="middle"
                scroll={{ x: 800 }}
              />
            ),
          },
          {
            key: 'logs',
            label: <span><SwapOutlined /> 订单变更日志</span>,
            children: (
              <Table
                columns={logColumns}
                dataSource={changeLogs}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                size="middle"
                scroll={{ x: 900 }}
                loading={loading}
              />
            ),
          },
        ]} />
      </div>
    </div>
  );
}
