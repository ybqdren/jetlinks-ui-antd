import PermissionButton from '@/components/PermissionButton';
import { Badge, Card, Empty, message, Tabs, Tooltip } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'umi';
import styles from '@/pages/link/Channel/Opcua/Access/index.less';
import ProTable, { ActionType, ProColumns } from '@jetlinks/pro-table';
import {
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { service } from '@/pages/link/Channel/Opcua';
import Save from '@/pages/link/Channel/Opcua/Save';
import { InstanceModel } from '@/pages/device/Instance';
import AddPoint from '@/pages/link/Channel/Opcua/Access/addPoint';
import useSendWebsocketMessage from '@/hooks/websocket/useSendWebsocketMessage';
import { map } from 'rxjs/operators';

const Opcua = () => {
  const intl = useIntl();
  const { permission } = PermissionButton.usePermission('link/Channel/Opcua');
  const [bindList, setBindList] = useState<any>([]);
  const [opcId, setOpcId] = useState<string>('');
  const actionRef = useRef<ActionType>();
  const [param, setParam] = useState({});
  const [visible, setVisible] = useState<boolean>(false);
  const [channel, setChannel] = useState<any>({});
  const [pointVisiable, setPointVisiable] = useState<boolean>(false);
  const [current, setCurrent] = useState<any>({});
  const [deviceId, setDeviceId] = useState<any>('');
  const [data, setData] = useState<any>([]);
  const [subscribeTopic] = useSendWebsocketMessage();
  const [propertyValue, setPropertyValue] = useState<any>({});
  const wsRef = useRef<any>();

  const columns: ProColumns<any>[] = [
    {
      title: '属性ID',
      dataIndex: 'property',
    },
    {
      title: '名称',
      dataIndex: 'name',
    },
    {
      title: 'OPC点位ID',
      dataIndex: 'opcPointId',
    },
    {
      title: '数据类型',
      dataIndex: 'dataType',
    },
    {
      title: '值',
      render: (record: any) => <>{propertyValue[record?.property] || '-'}</>,
    },
    {
      title: '状态',
      dataIndex: 'state',
      renderText: (state) => (
        <Badge text={state?.text} status={state?.value === 'disable' ? 'error' : 'success'} />
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      align: 'center',
      width: 200,
      render: (text, record) => [
        <PermissionButton
          isPermission={permission.update}
          key="edit"
          onClick={() => {
            setPointVisiable(true);
            setCurrent(record);
          }}
          type={'link'}
          style={{ padding: 0 }}
          tooltip={{
            title: intl.formatMessage({
              id: 'pages.data.option.edit',
              defaultMessage: '编辑',
            }),
          }}
        >
          <EditOutlined />
        </PermissionButton>,
        <PermissionButton
          type="link"
          key={'action'}
          style={{ padding: 0 }}
          popConfirm={{
            title: intl.formatMessage({
              id: `pages.data.option.${
                record.state?.value !== 'disable' ? 'disable' : 'enable'
              }.tips`,
              defaultMessage: '确认禁用？',
            }),
            onConfirm: async () => {
              if (record.state?.value === 'disable') {
                await service.enablePoint(record.deviceId, [record.id]);
              } else {
                await service.stopPoint(record.deviceId, [record.id]);
              }
              message.success(
                intl.formatMessage({
                  id: 'pages.data.option.success',
                  defaultMessage: '操作成功!',
                }),
              );
              actionRef.current?.reload();
            },
          }}
          isPermission={permission.action}
          tooltip={{
            title: intl.formatMessage({
              id: `pages.data.option.${record.state?.value !== 'disable' ? 'disable' : 'enable'}`,
              defaultMessage: record.state?.value !== 'disable' ? '禁用' : '启用',
            }),
          }}
        >
          {record.state?.value !== 'disable' ? <StopOutlined /> : <PlayCircleOutlined />}
        </PermissionButton>,
        <PermissionButton
          isPermission={permission.delete}
          style={{ padding: 0 }}
          disabled={record.state?.value === 'enable'}
          tooltip={{
            title:
              record.state?.value === 'disable'
                ? intl.formatMessage({
                    id: 'pages.data.option.remove',
                    defaultMessage: '删除',
                  })
                : '请先禁用该点位，再删除。',
          }}
          popConfirm={{
            title: '确认删除',
            disabled: record.state.value === 'enable',
            onConfirm: async () => {
              const resp: any = await service.deletePoint(record.id);
              if (resp.status === 200) {
                message.success(
                  intl.formatMessage({
                    id: 'pages.data.option.success',
                    defaultMessage: '操作成功!',
                  }),
                );
                actionRef.current?.reload();
              }
            },
          }}
          key="delete"
          type="link"
        >
          <DeleteOutlined />
        </PermissionButton>,
      ],
    },
  ];

  const getOpc = (id: string) => {
    service
      .noPagingOpcua({
        paging: false,
        terms: [
          {
            column: 'id$bind-opc',
            value: id,
          },
        ],
      })
      .then((res: any) => {
        setBindList(res.result);
        setOpcId(res.result?.[0]?.id);
        setParam({
          terms: [{ column: 'opcUaId', value: res.result?.[0]?.id }],
        });
      });
  };

  const edit = useMemo(
    () => (
      <Save
        data={channel}
        close={() => {
          setVisible(false);
        }}
        device={InstanceModel.detail}
      />
    ),
    [channel.id],
  );

  useEffect(() => {
    const { id } = InstanceModel.detail;
    setDeviceId(id);
    if (id) {
      getOpc(id);
    }
  }, [visible]);

  useEffect(() => {
    const { id, productId } = InstanceModel.detail;
    const point = data.map((item: any) => item.property);
    const wsId = `instance-info-property-${id}-${productId}-${point.join('-')}`;
    const topic = `/dashboard/device/${productId}/properties/realTime`;
    wsRef.current = subscribeTopic?.(wsId, topic, {
      deviceId: deviceId,
      properties: data.map((item: any) => item.property),
      history: 1,
    })
      ?.pipe(map((res: any) => res.payload))
      .subscribe((payload: any) => {
        const { value } = payload;
        propertyValue[value.property] = value.formatValue;
        setPropertyValue({ ...propertyValue });
        // console.log(propertyValue)
      });
  }, [data]);

  return (
    <Card className={styles.list}>
      <PermissionButton
        onClick={() => {
          setVisible(true);
          setChannel({});
        }}
        isPermission={permission.add}
        key="add"
        icon={<PlusOutlined />}
        type="dashed"
        style={{ width: '200px', margin: '16px 0 18px 20px' }}
      >
        新增通道
      </PermissionButton>
      {bindList.length > 0 ? (
        <div style={{ display: 'flex' }}>
          <div>
            <Tabs
              style={{ height: 600 }}
              tabPosition={'left'}
              defaultActiveKey={opcId}
              onChange={(e) => {
                setOpcId(e);
                setParam({
                  terms: [{ column: 'opcUaId', value: e }],
                });
              }}
            >
              {bindList.map((item: any) => (
                <Tabs.TabPane
                  key={item.id}
                  tab={
                    <div className={styles.left}>
                      <Tooltip title={item.name}>
                        <div className={styles.text}>{item.name}</div>
                      </Tooltip>
                      <div>
                        <PermissionButton
                          isPermission={permission.update}
                          key="edit"
                          onClick={() => {
                            setVisible(true);
                            setChannel(item);
                          }}
                          type={'link'}
                          style={{ padding: 0 }}
                          tooltip={{
                            title: intl.formatMessage({
                              id: 'pages.data.option.edit',
                              defaultMessage: '编辑',
                            }),
                          }}
                        >
                          <EditOutlined />
                        </PermissionButton>
                        <PermissionButton
                          isPermission={permission.delete}
                          style={{ padding: 0 }}
                          popConfirm={{
                            title: '确认删除',
                            onConfirm: async () => {
                              const resp: any = await service.remove(item.id);
                              if (resp.status === 200) {
                                getOpc(deviceId);
                                message.success(
                                  intl.formatMessage({
                                    id: 'pages.data.option.success',
                                    defaultMessage: '操作成功!',
                                  }),
                                );
                              }
                            },
                          }}
                          key="delete"
                          type="link"
                        >
                          <DeleteOutlined />
                        </PermissionButton>
                      </div>
                    </div>
                  }
                ></Tabs.TabPane>
              ))}
            </Tabs>
          </div>
          <div style={{ width: '100%' }}>
            <ProTable
              actionRef={actionRef}
              params={param}
              columns={columns}
              rowKey="id"
              search={false}
              headerTitle={
                <>
                  <PermissionButton
                    onClick={() => {
                      setPointVisiable(true);
                      setCurrent({});
                    }}
                    isPermission={permission.add}
                    key="add"
                    icon={<PlusOutlined />}
                    type="primary"
                  >
                    {intl.formatMessage({
                      id: 'pages.data.option.add',
                      defaultMessage: '新增',
                    })}
                  </PermissionButton>
                </>
              }
              request={async (params) => {
                const res = await service.PointList({
                  ...params,
                  sorts: [{ name: 'createTime', order: 'desc' }],
                });
                setData(res.result.data);
                return {
                  code: res.message,
                  result: {
                    data: res.result.data,
                    pageIndex: 0,
                    pageSize: 0,
                    total: 0,
                  },
                  status: res.status,
                };
              }}
            />
          </div>
        </div>
      ) : (
        <Empty />
      )}
      {visible && edit}
      {pointVisiable && (
        <AddPoint
          deviceId={deviceId}
          opcUaId={opcId}
          data={current}
          close={() => {
            setPointVisiable(false);
            actionRef.current?.reload();
          }}
        />
      )}
    </Card>
  );
};
export default Opcua;