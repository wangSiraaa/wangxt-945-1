import React, { useState, useEffect } from 'react';
import {
  DatePicker, Segmented, Select, Card, Row, Col, Button, Tag, Spin,
  message, Empty, Modal, Descriptions, List, Badge, Alert, Tooltip,
  Checkbox, Switch, Form, Input, InputNumber, Divider,
} from 'antd';
import {
  ShoppingCartOutlined, DeleteOutlined, ExclamationCircleOutlined,
  ClockCircleOutlined, WarningOutlined,
  TeamOutlined, PlusOutlined, UserOutlined,
} from '@ant-design/icons';
import {
  orderApi, menuApi, employeeApi, departmentApi, settingsApi,
  canteenApi, supplementApi,
} from '../api';
import dayjs from 'dayjs';

const { confirm } = Modal;
const { Option } = Select;
const { TextArea } = Input;

const mealTypeMap = {
  breakfast: { label: '🌅 早餐', key: 'breakfast' },
  lunch: { label: '🍽 午餐', key: 'lunch' },
  dinner: { label: '🌙 晚餐', key: 'dinner' },
};

export default function OrderPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [mealType, setMealType] = useState('lunch');
  const [canteenId, setCanteenId] = useState();
  const [canteens, setCanteens] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [dailyMenus, setDailyMenus] = useState([]);
  const [allMenus, setAllMenus] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [isExtra, setIsExtra] = useState(false);
  const [isProxy, setIsProxy] = useState(false);
  const [proxyEmployees, setProxyEmployees] = useState([]);
  const [shareDeptIds, setShareDeptIds] = useState([]);
  const [remark, setRemark] = useState('');
  const [allergenWarning, setAllergenWarning] = useState(null);
  const [supplementModalVisible, setSupplementModalVisible] = useState(false);
  const [supplementForm] = Form.useForm();
  const [originalOrder, setOriginalOrder] = useState(null);

  useEffect(() => {
    loadInitData();
  }, []);

  useEffect(() => {
    if (date && mealType) {
      loadDailyMenus();
      loadOrders();
    }
  }, [date, mealType, selectedEmp, canteenId]);

  useEffect(() => {
    checkAllergens();
  }, [selectedItems, selectedEmp, allMenus, dailyMenus]);

  const loadInitData = async () => {
    try {
      const [deptData, empData, settingsData, canteenData] = await Promise.all([
        departmentApi.list(),
        employeeApi.list(),
        settingsApi.list(),
        canteenApi.list(),
      ]);
      setDepartments(deptData);
      setEmployees(empData);
      setSettings(settingsData);
      setCanteens(canteenData);
      if (canteenData.length > 0) {
        setCanteenId(canteenData[0].id);
      }
    } catch (err) {
      message.error('初始化失败: ' + err.message);
    }
  };

  const loadDailyMenus = async () => {
    try {
      setLoading(true);
      const params = { date, meal_type: mealType };
      if (canteenId) params.canteen_id = canteenId;
      const [dailyData, menuData] = await Promise.all([
        menuApi.dailyList(params),
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

  const loadOrders = async () => {
    if (!selectedEmp) {
      setOrders([]);
      return;
    }
    try {
      const data = await orderApi.list({
        employee_id: selectedEmp,
        menu_date: date,
        meal_type: mealType,
      });
      setOrders(data);
    } catch (err) {
      message.error('加载订单失败');
    }
  };

  const checkAllergens = () => {
    if (!selectedEmp || selectedItems.length === 0) {
      setAllergenWarning(null);
      return;
    }
    const emp = employees.find((e) => e.id === selectedEmp);
    if (!emp || !emp.allergens || emp.allergens.length === 0) {
      setAllergenWarning(null);
      return;
    }
    const triggered = [];
    for (const item of selectedItems) {
      const dm = dailyMenus.find((d) => d.id === item.daily_menu_id);
      const menu = allMenus.find((m) => m.id === dm?.menu_id) || dm?.menu;
      if (menu?.allergens) {
        const hit = menu.allergens.filter((a) => emp.allergens.includes(a));
        if (hit.length > 0) {
          triggered.push({ menu: menu.name, allergens: hit });
        }
      }
    }
    if (triggered.length > 0) {
      setAllergenWarning(triggered);
    } else {
      setAllergenWarning(null);
    }
  };

  const toggleItem = (dm) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.daily_menu_id === dm.id);
      if (exists) return prev.filter((i) => i.daily_menu_id !== dm.id);
      return [...prev, { daily_menu_id: dm.id, quantity: 1, menu_id: dm.menu_id, canteen_id: canteenId }];
    });
  };

  const updateItemQty = (dmId, qty) => {
    if (qty < 1) qty = 1;
    setSelectedItems((prev) =>
      prev.map((i) => (i.daily_menu_id === dmId ? { ...i, quantity: qty } : i))
    );
  };

  const totalAmount = selectedItems.reduce((sum, item) => {
    const dm = dailyMenus.find((d) => d.id === item.daily_menu_id);
    const menu = allMenus.find((m) => m.id === dm?.menu_id) || dm?.menu;
    return sum + (menu?.price || 0) * item.quantity;
  }, 0);

  const selectedEmployee = employees.find((e) => e.id === selectedEmp);
  const selectedDept = departments.find((d) => d.id === selectedEmployee?.department_id);
  const subsidyRatio = selectedDept?.subsidy_ratio || 0.7;
  const subsidyAmount = totalAmount * subsidyRatio;
  const personalPay = totalAmount - subsidyAmount;

  const handleOrder = async () => {
    if (!selectedEmp) return message.warning('请先选择员工');
    if (selectedItems.length === 0) return message.warning('请选择餐品');
    if (isProxy && proxyEmployees.length === 0) return message.warning('请选择代订员工');

    setSubmitting(true);
    try {
      const employeeIds = isProxy ? proxyEmployees : [selectedEmp];
      let results = [];

      for (const empId of employeeIds) {
        const payload = {
          employee_id: empId,
          menu_date: date,
          meal_type: mealType,
          items: selectedItems,
          canteen_id: canteenId,
          is_extra: isExtra ? 1 : 0,
          share_dept_ids: shareDeptIds,
          remark,
        };
        if (isExtra) {
          const result = await supplementApi.create({
            ...payload,
            is_extra: true,
            reason: remark || '临时加餐',
          });
          results.push(result);
        } else {
          const result = await orderApi.create(payload);
          results.push(result);
        }
      }

      const anyNeedApproval = results.some((r) => r.needs_approval);
      if (anyNeedApproval) {
        message.warning(`有订单因预算不足进入待审批状态`);
      } else {
        message.success(`订餐成功！共 ${results.length} 单`);
      }

      setSelectedItems([]);
      setIsExtra(false);
      setIsProxy(false);
      setProxyEmployees([]);
      setShareDeptIds([]);
      setRemark('');
      loadOrders();
      loadDailyMenus();
    } catch (err) {
      message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = (order) => {
    confirm({
      title: '确认取消订单？',
      icon: <ExclamationCircleOutlined />,
      content: order.status === 'pending_approval'
        ? '审批中订单取消后审批将自动关闭'
        : order.is_supplement || order.is_extra
          ? '补改单/加餐订单取消'
          : '超时取消可能产生取消费用',
      onOk: async () => {
        try {
          const result = await orderApi.cancel(order.id);
          if (result.cancel_fee > 0) {
            message.warning(`已取消，产生取消费用 ¥${result.cancel_fee.toFixed(2)}`);
          } else {
            message.success('订单已取消');
          }
          loadOrders();
          loadDailyMenus();
        } catch (err) {
          message.error(err.message);
        }
      },
    });
  };

  const handleOpenSupplement = (order) => {
    setOriginalOrder(order);
    supplementForm.resetFields();
    setSupplementModalVisible(true);
  };

  const handleSubmitSupplement = () => {
    supplementForm.validateFields().then(async (values) => {
      setSubmitting(true);
      try {
        await supplementApi.create({
          original_order_id: originalOrder.id,
          employee_id: originalOrder.employee_id,
          menu_date: originalOrder.menu_date,
          meal_type: originalOrder.meal_type,
          items: [{ daily_menu_id: values.daily_menu_id, quantity: values.quantity }],
          reason: values.reason,
          is_extra: false,
        });
        message.success('补改单成功');
        setSupplementModalVisible(false);
        loadOrders();
        loadDailyMenus();
      } catch (err) {
        message.error(err.message);
      } finally {
        setSubmitting(false);
      }
    });
  };

  const cutoffBreakfast = settings.find((s) => s.key === 'cutoff_time_breakfast')?.value || '08:00';
  const cutoffLunch = settings.find((s) => s.key === 'cutoff_time_lunch')?.value || '10:00';
  const cutoffDinner = settings.find((s) => s.key === 'cutoff_time_dinner')?.value || '16:00';
  const currentCutoff = mealType === 'breakfast' ? cutoffBreakfast : mealType === 'lunch' ? cutoffLunch : cutoffDinner;
  const cancelDeadline = settings.find((s) => s.key === 'cancel_fee_deadline_minutes')?.value || '60';
  const cancelFeePct = settings.find((s) => s.key === 'cancel_fee_percentage')?.value || '0.5';

  const getStatusTag = (status, order) => {
    const map = {
      confirmed: { color: 'green', text: '已确认' },
      pending_approval: { color: 'orange', text: '待审批' },
      cancelled: { color: 'red', text: '已取消' },
      rejected: { color: 'volcano', text: '已驳回' },
    };
    const s = map[status] || { color: 'default', text: status };
    return (
      <Space>
        <Tag color={s.color}>{s.text}</Tag>
        {order?.is_extra === 1 && <Tag color="purple">加餐</Tag>}
        {order?.is_supplement === 1 && <Tag color="cyan">补改单</Tag>}
        {order?.verified === 1 && <Tag color="green">已核销</Tag>}
      </Space>
    );
  };

  const availableEmployeesForProxy = employees.filter(
    (e) => e.id !== selectedEmp && (!selectedEmployee?.department_id || e.department_id === selectedEmployee.department_id)
  );

  return (
    <div>
      <div className="page-header">
        <h2>
          <ShoppingCartOutlined /> 员工订餐
        </h2>
        <p>选择员工和日期进行订餐或取消，支持代订、加餐和跨部门分摊</p>
      </div>

      <Alert
        message={
          <span>
            <ClockCircleOutlined /> {mealTypeMap[mealType]?.label}截单时间: <b>{currentCutoff}</b>
            {' · '}超时取消收取 <b>{(cancelFeePct * 100).toFixed(0)}%</b> 费用
            {' · '}免费取消截止: 截单前 <b>{cancelDeadline}分钟</b>
          </span>
        }
        type="info"
        showIcon
        icon={<WarningOutlined />}
        style={{ marginBottom: 16 }}
      />

      {allergenWarning && (
        <Alert
          message={
            <div>
              <WarningOutlined /> <b>过敏原警告：</b>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                {allergenWarning.map((w, idx) => (
                  <li key={idx}>
                    <b>{w.menu}</b> 包含您的过敏原: {w.allergens.join('、')}
                  </li>
                ))}
              </ul>
            </div>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setAllergenWarning(null)}
        />
      )}

      <div className="card-container">
        <Card title="订餐选项" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 12]} align="middle">
            <Col xs={24} sm={12} md={6}>
              <Select
                style={{ width: '100%' }}
                placeholder="选择员工"
                value={selectedEmp}
                onChange={(v) => {
                  setSelectedEmp(v);
                  setProxyEmployees([]);
                }}
                options={employees.map((e) => {
                  const dept = departments.find((d) => d.id === e.department_id);
                  return { label: `${e.name} (${dept?.name || ''})`, value: e.id };
                })}
                showSearch
                optionFilterProp="label"
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Select
                style={{ width: '100%' }}
                placeholder="选择食堂"
                value={canteenId}
                onChange={setCanteenId}
                allowClear
              >
                {canteens.map((c) => (
                  <Option key={c.id} value={c.id}>
                    {c.name}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={5}>
              <DatePicker
                style={{ width: '100%' }}
                value={dayjs(date)}
                onChange={(_, ds) => setDate(ds)}
                allowClear={false}
              />
            </Col>
            <Col xs={24} sm={12} md={7}>
              <Segmented
                value={mealType}
                onChange={setMealType}
                options={[
                  { label: '🌅 早餐', value: 'breakfast' },
                  { label: '🍽 午餐', value: 'lunch' },
                  { label: '🌙 晚餐', value: 'dinner' },
                ]}
              />
            </Col>
          </Row>

          <Divider style={{ margin: '16px 0' }} />

          <Row gutter={[16, 12]} align="middle">
            <Col>
              <Tooltip title="截单后订餐请勾选，需走补改单流程并产生差异结算">
                <Checkbox checked={isExtra} onChange={(e) => setIsExtra(e.target.checked)}>
                  <PlusOutlined /> 临时加餐
                </Checkbox>
              </Tooltip>
            </Col>
            <Col>
              <Tooltip title="勾选后可同时为多个同事订餐">
                <Checkbox checked={isProxy} onChange={(e) => {
                  setIsProxy(e.target.checked);
                  if (!e.target.checked) setProxyEmployees([]);
                }}>
                  <TeamOutlined /> 多人代订
                </Checkbox>
              </Tooltip>
            </Col>
            {isProxy && (
              <Col flex="auto">
                <Select
                  mode="multiple"
                  style={{ width: '100%', minWidth: 300 }}
                  placeholder="选择代订员工"
                  value={proxyEmployees}
                  onChange={setProxyEmployees}
                  maxTagCount={5}
                >
                  {availableEmployeesForProxy.map((e) => (
                    <Option key={e.id} value={e.id}>
                      {e.name} ({e.employee_no})
                    </Option>
                  ))}
                </Select>
              </Col>
            )}
          </Row>

          <Row gutter={[16, 12]} style={{ marginTop: 12 }} align="middle">
            <Col>
              <span style={{ marginRight: 8 }}>跨部门分摊：</span>
            </Col>
            <Col flex="auto">
              <Select
                mode="multiple"
                style={{ width: '100%', minWidth: 300 }}
                placeholder="选择分摊部门（可选，默认订餐员工所在部门）"
                value={shareDeptIds}
                onChange={setShareDeptIds}
                maxTagCount={3}
              >
                {departments.map((d) => (
                  <Option key={d.id} value={d.id}>
                    {d.name}（补贴比例: {(d.subsidy_ratio * 100).toFixed(0)}%）
                  </Option>
                ))}
              </Select>
            </Col>
            <Col>
              <Input
                style={{ width: 200 }}
                placeholder="备注"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                allowClear
              />
            </Col>
          </Row>
        </Card>

        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <h4 style={{ marginBottom: 12 }}>
              选择餐品
              {selectedEmployee?.allergens?.length > 0 && (
                <Tooltip title={`您的过敏原: ${selectedEmployee.allergens.join('、')}`}>
                  <Tag color="warning" style={{ marginLeft: 8 }}>
                    <WarningOutlined /> 过敏原: {selectedEmployee.allergens.join('/')}
                  </Tag>
                </Tooltip>
              )}
            </h4>
            {loading ? (
              <Spin style={{ display: 'block', margin: '40px auto' }} />
            ) : dailyMenus.length === 0 ? (
              <Empty description="该日期此餐别暂无菜品，请更换食堂或日期" />
            ) : (
              <Row gutter={[12, 12]}>
                {dailyMenus.map((dm) => {
                  const menu = allMenus.find((m) => m.id === dm.menu_id) || dm.menu || {};
                  const isSelected = selectedItems.some((i) => i.daily_menu_id === dm.id);
                  const selectedItem = selectedItems.find((i) => i.daily_menu_id === dm.id);
                  const isOutOfStock = dm.stock <= 0;
                  const hasAllergenWarning =
                    selectedEmployee?.allergens?.length > 0 &&
                    menu?.allergens?.some((a) => selectedEmployee.allergens.includes(a));
                  return (
                    <Col xs={12} sm={8} md={6} key={dm.id}>
                      <div
                        className={`menu-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => !isOutOfStock && toggleItem(dm)}
                        style={{
                          opacity: isOutOfStock ? 0.5 : 1,
                          cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                          borderColor: hasAllergenWarning ? '#ff4d4f' : undefined,
                        }}
                      >
                        <div className="menu-name">
                          {menu.name || dm.menu_name}
                          {menu?.version && (
                            <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>
                              v{menu.version}
                            </Tag>
                          )}
                        </div>
                        <div className="menu-price">¥{menu.price || 0}</div>
                        {menu?.allergens?.length > 0 && (
                          <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 2 }}>
                            <WarningOutlined /> {menu.allergens.join('/')}
                          </div>
                        )}
                        {menu?.substitute_rule && (
                          <div style={{ fontSize: 11, color: '#1890ff', marginTop: 2 }}>
                            替餐: {menu.substitute_rule}
                          </div>
                        )}
                        <div className={`menu-stock ${dm.stock <= 0 ? 'out' : dm.stock < 10 ? 'low' : ''}`}>
                          {dm.stock <= 0 ? '售罄' : `余${dm.stock}份`}
                          {dm.predict_qty && <span style={{ marginLeft: 8, fontSize: 10, color: '#8c8c8c' }}>预测{dm.predict_qty}</span>}
                        </div>
                        {isSelected && (
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Button size="small" onClick={(e) => { e.stopPropagation(); updateItemQty(dm.id, (selectedItem?.quantity || 1) - 1); }}>
                              -
                            </Button>
                            <span style={{ fontWeight: 'bold' }}>{selectedItem?.quantity || 1}</span>
                            <Button size="small" onClick={(e) => { e.stopPropagation(); updateItemQty(dm.id, (selectedItem?.quantity || 1) + 1); }}>
                              +
                            </Button>
                          </div>
                        )}
                      </div>
                    </Col>
                  );
                })}
              </Row>
            )}

            {selectedItems.length > 0 && (
              <div style={{ marginTop: 16, padding: 16, background: '#f6ffed', borderRadius: 8 }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <div>
                      已选 <b>{selectedItems.length}</b> 项
                      {isProxy && <Tag color="purple" style={{ marginLeft: 8 }}>代订 {proxyEmployees.length || 1} 人</Tag>}
                      {isExtra && <Tag color="orange" style={{ marginLeft: 8 }}>临时加餐</Tag>}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      合计: <span style={{ fontSize: 22, color: '#f5222d', fontWeight: 700 }}>¥{totalAmount.toFixed(2)}</span>
                      {selectedDept && (
                        <span style={{ marginLeft: 12, fontSize: 13, color: '#8c8c8c' }}>
                          补贴 <Tag color="green">¥{subsidyAmount.toFixed(2)}</Tag>
                          自付 <Tag color="orange">¥{personalPay.toFixed(2)}</Tag>
                          （补贴比例 {(subsidyRatio * 100).toFixed(0)}%）
                        </span>
                      )}
                    </div>
                  </Col>
                  <Col>
                    <Space>
                      <Button size="large" onClick={() => setSelectedItems([])}>清空</Button>
                      <Button type="primary" size="large" onClick={handleOrder} loading={submitting}>
                        提交订单
                      </Button>
                    </Space>
                  </Col>
                </Row>
              </div>
            )}
          </Col>

          <Col xs={24} lg={10}>
            <h4 style={{ marginBottom: 12 }}>我的订单</h4>
            {!selectedEmp ? (
              <Empty description="请先选择员工" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : orders.length === 0 ? (
              <Empty description="暂无订单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                dataSource={orders}
                renderItem={(order) => (
                  <div className="order-card" key={order.id}>
                    <Row justify="space-between" align="top">
                      <Col style={{ flex: 1 }}>
                        <div>
                          <b>{order.order_no}</b>
                          <span style={{ marginLeft: 8 }}>{getStatusTag(order.status, order)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                          {order.items?.map((i) => (
                            <span key={i.id}>
                              {i.menu_name}
                              {i.is_substituted === 1 && <Tag color="orange" style={{ marginLeft: 2, fontSize: 10 }}>已替餐</Tag>}
                              x{i.quantity}
                              {' '}
                            </span>
                          ))}
                        </div>
                        {(order.is_supplement || order.is_extra) && order.remark && (
                          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                            备注: {order.remark}
                          </div>
                        )}
                        {order.subsidy_amount != null && (
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            <Tag color="green">补贴 ¥{order.subsidy_amount.toFixed(2)}</Tag>
                            <Tag color="orange">自付 ¥{order.personal_pay.toFixed(2)}</Tag>
                          </div>
                        )}
                      </Col>
                      <Col style={{ textAlign: 'right', marginLeft: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#f5222d' }}>
                          ¥{order.total_amount?.toFixed(2)}
                        </div>
                        <Space style={{ marginTop: 6 }} wrap>
                          {(order.status === 'confirmed' || order.status === 'pending_approval') &&
                            order.is_cancelled === 0 && (
                              <>
                                <Button
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => handleCancel(order)}
                                >
                                  取消
                                </Button>
                                <Button
                                  size="small"
                                  onClick={() => handleOpenSupplement(order)}
                                >
                                  补改
                                </Button>
                              </>
                            )}
                        </Space>
                        {order.cancel_fee > 0 && (
                          <div style={{ fontSize: 12, color: '#faad14', marginTop: 4 }}>
                            取消费: ¥{order.cancel_fee.toFixed(2)}
                          </div>
                        )}
                      </Col>
                    </Row>
                  </div>
                )}
              />
            )}
          </Col>
        </Row>
      </div>

      <Modal
        title="补改单"
        open={supplementModalVisible}
        onOk={handleSubmitSupplement}
        onCancel={() => setSupplementModalVisible(false)}
        confirmLoading={submitting}
        width={500}
      >
        {originalOrder && (
          <div style={{ marginBottom: 16 }}>
            <Alert
              message={`原订单: ${originalOrder.order_no} (${originalOrder.menu_date} ${mealTypeMap[originalOrder.meal_type]?.label})`}
              type="info"
              showIcon
            />
          </div>
        )}
        <Form form={supplementForm} layout="vertical">
          <Form.Item
            name="daily_menu_id"
            label="选择补改餐品"
            rules={[{ required: true, message: '请选择餐品' }]}
          >
            <Select placeholder="选择餐品">
              {dailyMenus
                .filter((d) => d.stock > 0)
                .map((d) => {
                  const menu = allMenus.find((m) => m.id === d.menu_id) || d.menu;
                  return (
                    <Option key={d.id} value={d.id}>
                      {menu?.name || d.menu_name} (库存: {d.stock}, ¥{menu?.price})
                    </Option>
                  );
                })}
            </Select>
          </Form.Item>
          <Form.Item
            name="quantity"
            label="数量"
            rules={[{ required: true, message: '请输入数量' }]}
            initialValue={1}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="补改原因" rules={[{ required: true, message: '请输入原因' }]}>
            <TextArea rows={3} placeholder="如：漏订、需加量等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
