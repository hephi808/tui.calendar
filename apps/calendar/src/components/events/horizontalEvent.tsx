import { h } from 'preact';
import { useRef, useState } from 'preact/hooks';

import { ResizeIcon } from '@src/components/events/resizeIcon';
import { Template } from '@src/components/template';
import { useDispatch, useStore } from '@src/contexts/calendarStore';
import { useEventBus } from '@src/contexts/eventBus';
import { cls, toPercent, toPx } from '@src/helpers/css';
import { DRAGGING_TYPE_CREATORS } from '@src/helpers/drag';
import { useDrag } from '@src/hooks/common/drag';
import { useTransientUpdate } from '@src/hooks/common/transientUpdate';
import EventUIModel from '@src/model/eventUIModel';
import { dndSelector, optionsSelector } from '@src/selectors';
import { DraggingState } from '@src/slices/dnd';
import { passConditionalProp } from '@src/utils/preact';
import { isNil } from '@src/utils/type';

interface Props {
  uiModel: EventUIModel;
  eventHeight: number;
  headerHeight: number;
  resizingWidth?: string | null;
  flat?: boolean;
  movingLeft?: number | null;
}

type StyleProps = Required<Props> & { isDraggingTarget: boolean };

function getMargin(flat: boolean) {
  return {
    vertical: flat ? 5 : 2,
    horizontal: 8,
  };
}

function getExceedClassName(exceedLeft: boolean, exceedRight: boolean) {
  const className = [];

  if (exceedLeft) {
    className.push(cls('weekday-exceed-left'));
  }

  if (exceedRight) {
    className.push(cls('weekday-exceed-right'));
  }

  return className.join(' ');
}

function getEventItemStyle({
  flat,
  bgColor,
  borderColor,
  exceedLeft,
  exceedRight,
  eventHeight,
  isDraggingTarget,
}: EventItemStyleParam) {
  const defaultItemStyle = {
    color: '#333',
    backgroundColor: bgColor,
    borderLeft: exceedLeft ? 'none' : `3px solid ${borderColor}`,
    borderRadius: exceedLeft ? 0 : 2,
    overflow: 'hidden',
    height: eventHeight,
    lineHeight: toPx(eventHeight),
    opacity: isDraggingTarget ? 0.5 : 1,
  };
  const margin = getMargin(flat);

  return flat
    ? {
        marginTop: margin.vertical,
        ...defaultItemStyle,
      }
    : {
        marginLeft: exceedLeft ? 0 : margin.horizontal,
        marginRight: exceedRight ? 0 : margin.horizontal,
        ...defaultItemStyle,
      };
}

function getStyles({
  uiModel,
  eventHeight,
  headerHeight,
  flat,
  isDraggingTarget,
  movingLeft,
  resizingWidth,
}: StyleProps) {
  const {
    width,
    left,
    top,
    exceedLeft,
    exceedRight,
    model: { bgColor, borderColor },
  } = uiModel;

  const margin = getMargin(flat);

  const containerStyle = flat
    ? {}
    : {
        width: resizingWidth || toPercent(width),
        left: toPercent(movingLeft ?? left),
        top: toPx((top - 1) * (eventHeight + margin.vertical) + headerHeight),
        position: 'absolute',
      };

  const eventItemStyle = getEventItemStyle({
    flat,
    exceedLeft,
    exceedRight,
    bgColor,
    borderColor,
    eventHeight,
    isDraggingTarget,
  });

  const resizeIconStyle = {
    lineHeight: toPx(18),
  };

  const dayEventBlockClassName = `${cls('weekday-event-block')} ${getExceedClassName(
    exceedLeft,
    exceedRight
  )}`;

  return { dayEventBlockClassName, containerStyle, eventItemStyle, resizeIconStyle };
}

function getTestId({ model }: EventUIModel) {
  const calendarId = model.calendarId ? `${model.calendarId}-` : '';
  const id = model.id ? `${model.id}-` : '';

  return `${calendarId}${id}${model.title}`;
}

export function HorizontalEvent({
  flat = false,
  uiModel,
  eventHeight,
  headerHeight,
  resizingWidth = null,
  movingLeft = null,
}: Props) {
  const [isDraggingTarget, setIsDraggingTarget] = useState<boolean>(false);

  const { dayEventBlockClassName, containerStyle, eventItemStyle, resizeIconStyle } = getStyles({
    uiModel,
    eventHeight,
    headerHeight,
    flat,
    isDraggingTarget,
    resizingWidth,
    movingLeft,
  });

  const { useDetailPopup } = useStore(optionsSelector);
  const { setDraggingEventUIModel } = useDispatch('dnd');
  const { showDetailPopup } = useDispatch('popup');
  const eventBus = useEventBus();

  const eventContainerRef = useRef<HTMLDivElement>(null);

  const clearIsDraggingTarget = () => setIsDraggingTarget(false);

  useTransientUpdate(dndSelector, ({ draggingEventUIModel, draggingState }) => {
    if (
      draggingState === DraggingState.DRAGGING &&
      draggingEventUIModel?.cid() === uiModel.cid() &&
      isNil(resizingWidth) &&
      isNil(movingLeft)
    ) {
      setIsDraggingTarget(true);
    } else {
      setIsDraggingTarget(false);
    }
  });

  const onResizeStart = useDrag(DRAGGING_TYPE_CREATORS.resizeEvent('dayGrid', `${uiModel.cid()}`), {
    onInit: () => {
      setDraggingEventUIModel(uiModel);
    },
    onMouseUp: clearIsDraggingTarget,
  });
  const onMoveStart = useDrag(DRAGGING_TYPE_CREATORS.moveEvent('dayGrid', `${uiModel.cid()}`), {
    onInit: () => {
      setDraggingEventUIModel(uiModel);
    },
    onMouseUp: (e, { draggingState }) => {
      clearIsDraggingTarget();

      const isNotDragging = draggingState <= DraggingState.INIT;
      if (isNotDragging && useDetailPopup && eventContainerRef.current) {
        showDetailPopup(
          {
            event: uiModel.model,
            eventRect: eventContainerRef.current.getBoundingClientRect(),
          },
          flat
        );
      }

      eventBus.fire('clickEvent', { event: uiModel.model, nativeEvent: e });
    },
  });

  const handleResizeStart = (e: MouseEvent) => {
    e.stopPropagation();
    onResizeStart(e);
  };

  const handleMoveStart = (e: MouseEvent) => {
    e.stopPropagation();
    onMoveStart(e);
  };

  const { isReadOnly } = uiModel.model;
  const shouldHideResizeHandler = flat || isDraggingTarget || uiModel.exceedRight || isReadOnly;
  const isDraggableEvent = isNil(resizingWidth) && isNil(movingLeft);

  return (
    <div
      className={dayEventBlockClassName}
      style={containerStyle}
      data-testid={passConditionalProp(isDraggableEvent, getTestId(uiModel))}
      ref={eventContainerRef}
    >
      <div
        className={cls('weekday-event')}
        style={eventItemStyle}
        onMouseDown={passConditionalProp(isDraggableEvent, handleMoveStart)}
      >
        <span className={cls('weekday-event-title')}>
          <Template template="time" model={uiModel.model} />
        </span>
        {shouldHideResizeHandler ? null : (
          <ResizeIcon
            style={resizeIconStyle}
            onMouseDown={passConditionalProp(isDraggableEvent, handleResizeStart)}
          />
        )}
      </div>
    </div>
  );
}
