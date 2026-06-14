import React, { useState, useEffect } from 'react';
import {
  DatePicker, Table, Card, Row, Col, Statistic, Tag, Spin,
  message, Empty, Tabs, Button, Modal, Select, Tooltip, Descriptions, Space,
  Alert, Divider, Progress
} from 'antd';
import {
  DollarOutlined, AccountBookOutlined, AuditOutlined,
  RedoOutlined, SwapOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  TeamOutlined, CalendarOutlined, SafetyCertificateOutlined, FileSearchOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { financeLedgerApi, orderChangeLogApi, departmentApi } from '../api';
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
  const [departments, setDepartments] = useState([]);
  const [deptRecalc, setDeptRecalc] = useState('all');

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

  useEffect(() => {
    (async () => {
      try {
        const list = await departmentApi.list();
        setDepartments(list || []);
      } catch (_) {
      }
    })();
  }, []);

  const handleRecalculate = () => {
    const y = parseInt(month.substring(0, 4), 10);
    const m = parseInt(month.substring(5, 7), 10);
    const start_date = `${month}-01`;
    const endDateObj = new Date(y, m, 0);
    const end_date = `${month}-${String(endDateObj.getDate()).padStart(2, '0')}`;
    const deptName = deptRecalc === 'all'
      ? `全部 ${departments.length} 个部门`
      : (departments.find(d => d.id == deptRecalc)?.name || `部门 #${deptRecalc}`);

    const modal = Modal.confirm({
      title: (
        <span>
          <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
          月底重算 · 参数确认
        </span>
      ),
      icon: null,
      okText: '确认执行重算',
      okType: 'danger',
      cancelText: '取消',
      width: 620,
      content: (
        <div>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="此操作将先清除选定范围内的所有财务分账记录，再根据订单变更日志从流水重新推导。执行后旧数据不可恢复。"
          />
          <Descriptions bordered size="small" column={1} labelStyle={{ width: 130, background: '#fafafa' }}>
            <Descriptions.Item label={<span><CalendarOutlined style={{ marginRight: 4 }} />月份</span>}>
              <Tag color="blue">{month}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="起算日期 (start_date)">{start_date}</Descriptions.Item>
            <Descriptions.Item label="截止日期 (end_date)">{end_date}</Descriptions.Item>
            <Descriptions.Item label={<span><TeamOutlined style={{ marginRight: 4 }} />重算范围</span>}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Select
                  value={deptRecalc}
                  onChange={setDeptRecalc}
                  style={{ width: '100%' }}
                  options={[
                    { label: '全部部门（推荐）', value: 'all' },
                    ...departments.map(d => ({ label: d.name, value: String(d.id) })),
                  ]}
                />
                <span style={{ color: '#666', fontSize: 12 }}>当前选中：{deptName}</span>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label={<span><SafetyCertificateOutlined style={{ marginRight: 4 }} />分账类型</span>}>
              <Space wrap>
                <Tag color="blue">补贴</Tag>
                <Tag color="green">个人自费</Tag>
                <Tag color="orange">部门预算</Tag>
                <Tag color="purple">项目分摊</Tag>
                <Tag color="red">超时扣费</Tag>
                <Tag color="volcano">补贴冲回</Tag>
                <Tag color="lime">个人冲回</Tag>
                <Tag color="cyan">预算释放</Tag>
                <Tag color="geekblue">补贴调整</Tag>
                <Tag color="gold">个人调整</Tag>
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
      onOk: async () => {
        try {
          setRecalculating(true);
          const hide = message.loading('正在执行月底重算，请稍候...', 0);

          const result = await financeLedgerApi.recalculate({
            month,
            department_id: deptRecalc === 'all' ? undefined : parseInt(deptRecalc, 10),
          });

          hide();

          const typeTotals = result.type_totals || {};
          const checks = [
            { name: '补贴 (subsidy)', key: 'subsidy', expected: true },
            { name: '个人自费 (personal)', key: 'personal', expected: true },
            { name: '预算占用 (budget_use)', key: 'budget_use', expected: true },
            { name: '项目分摊 (project_share)', key: 'project_share', expected: false },
            { name: '超时扣费 (overtime_fee)', key: 'overtime_fee', expected: false },
            { name: '补贴冲回 (subsidy_reverse)', key: 'subsidy_reverse', expected: false },
            { name: '个人冲回 (personal_reverse)', key: 'personal_reverse', expected: false },
            { name: '预算释放 (budget_release)', key: 'budget_release', expected: false },
          ];
          const mandatory = ['subsidy', 'personal', 'budget_use'];

          await new Promise(r => setTimeout(r, 400));
          const newLedger = await financeLedgerApi.list({ month });

          const deptSumInLedger = {};
          for (const e of (newLedger.entries || [])) {
            deptSumInLedger[e.entry_type] = (deptSumInLedger[e.entry_type] || 0) + (e.amount || 0);
          }

          let inconsistent = [];
          for (const k of Object.keys(typeTotals)) {
            const a = +(typeTotals[k] || 0).toFixed(2);
            const b = +(deptSumInLedger[k] || 0).toFixed(2);
            if (a !== b) {
              inconsistent.push(`${k}: ${a} vs ${b}`);
            }
          }
          if (newLedger.entries?.length !== result.new_entries) {
            inconsistent.push(`条目数量: 查询${newLedger.entries?.length} vs 重算${result.new_entries}`);
          }
          const allMandatoryOk = mandatory.every(k => typeTotals[k] !== undefined);
          const consistencyOk = inconsistent.length === 0;
          const overallOk = allMandatoryOk && consistencyOk;

          Modal.success({
            title: overallOk
              ? <span><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />月底重算成功 · 回归验证通过</span>
              : <span><CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />月底重算完成，但存在回归验证告警</span>,
            width: 720,
            content: (
              <div>
                <Descriptions bordered size="small" column={2} labelStyle={{ width: 140, background: '#fafafa' }}>
                  <Descriptions.Item label="重算月份">{result.month}</Descriptions.Item>
                  <Descriptions.Item label="部门数">{result.department_count}</Descriptions.Item>
                  <Descriptions.Item label="日期范围">{result.start_date} ~ {result.end_date}</Descriptions.Item>
                  <Descriptions.Item label="涉及订单">{result.recalculated_orders} 单</Descriptions.Item>
                  <Descriptions.Item label="变更日志">按 {result.processed_change_logs} 条流水推导</Descriptions.Item>
                  <Descriptions.Item label="删除旧条目">{result.removed_entries} 笔</Descriptions.Item>
                  <Descriptions.Item label="生成新条目">{result.new_entries} 笔</Descriptions.Item>
                  <Descriptions.Item label="必选分账完整性">
                    {allMandatoryOk
                      ? <Tag color="green">OK — 补贴/自费/预算全部生成</Tag>
                      : <Tag color="red">MISSING</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="重算↔查询一致性">
                    {consistencyOk
                      ? <Tag color="green">OK — 类型汇总一致</Tag>
                      : <Tag color="red">{inconsistent.length} 处不一致</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="回归验证结论">
                    {overallOk
                      ? <Tag color="green" style={{ fontSize: 13 }}>全部通过 ✓</Tag>
                      : <Tag color="orange" style={{ fontSize: 13 }}>存在告警，详情如下</Tag>}
                  </Descriptions.Item>
                </Descriptions>

                <Divider orientation="left" style={{ margin: '16px 0 8px' }}>
                  <span style={{ fontSize: 13 }}><FileSearchOutlined style={{ marginRight: 4 }} />分账类型明细</span>
                </Divider>
                <div style={{ maxHeight: 260, overflow: 'auto' }}>
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="key"
                    columns={[
                      {
                        title: '分账类型', dataIndex: 'name', key: 'name', width: 200,
                        render: (v, r) => <span>
                          <Tag color={entryTypeMap[r.key]?.color || 'default'} style={{ marginRight: 6 }}>
                            {entryTypeMap[r.key]?.label || r.key}
                          </Tag>
                          {v}
                        </span>,
                      },
                      {
                        title: '重算返回合计', dataIndex: 'apiTotal', key: 'apiTotal', align: 'right', width: 160,
                        render: v => <span style={{ fontWeight: 600 }}>{v.toFixed(2)}</span>,
                      },
                      {
                        title: '查询流水合计', dataIndex: 'listTotal', key: 'listTotal', align: 'right', width: 160,
                        render: v => v.toFixed(2),
                      },
                      {
                        title: '验证结果', key: 'check', align: 'center', width: 120,
                        render: (_, r) => r.check === 'OK'
                          ? <Tag color="green">✓ 一致</Tag>
                          : r.check === 'EMPTY'
                            ? <Tag>—</Tag>
                            : <Tag color="red">✗ 差异</Tag>,
                      },
                    ]}
                    dataSource={checks.concat([
                      { name: '补贴冲回 (subsidy_reverse)', key: 'subsidy_reverse', expected: false },
                      { name: '个人冲回 (personal_reverse)', key: 'personal_reverse', expected: false },
                      { name: '预算释放 (budget_release)', key: 'budget_release', expected: false },
                      { name: '补贴调整 (subsidy_adjust)', key: 'subsidy_adjust', expected: false },
                      { name: '个人调整 (personal_adjust)', key: 'personal_adjust', expected: false },
                    ]).map(c => {
                      const apiTotal = +(typeTotals[c.key] || 0).toFixed(2);
                      const listTotal = +(deptSumInLedger[c.key] || 0).toFixed(2);
                      let check = 'EMPTY';
                      if (apiTotal !== 0 || listTotal !== 0) {
                        check = Math.abs(apiTotal - listTotal) < 0.01 ? 'OK' : 'DIFF';
                      }
                      return { ...c, apiTotal, listTotal, check };
                    })}
                  />
                </div>

                {!consistencyOk && <Alert
                  style={{ marginTop: 12 }}
                  type="error"
                  showIcon
                  message="回归验证发现以下不一致"
                  description={inconsistent.map((x, i) => <div key={i}>• {x}</div>)}
                />}
              </div>
            ),
            onOk: async () => {
              modal && modal.destroy && modal.destroy();
              loadLedger();
            },
          });
        } catch (err) {
          Modal.error({
            title: '月底重算失败',
            content: err?.message || '未知错误，请联系技术支持',
          });
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
