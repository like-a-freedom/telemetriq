import { defineComponent, mergeProps, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrInterpolate } from 'vue/server-renderer';
import { _ as _export_sfc } from '../main.mjs';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "FileInfo",
  __ssrInlineRender: true,
  props: {
    label: {},
    value: {}
  },
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: "file-info",
        "data-testid": "file-info"
      }, _attrs))} data-v-3d1acb3e><div class="file-info__row" data-v-3d1acb3e><span class="file-info__label" data-v-3d1acb3e>${ssrInterpolate(__props.label)}</span><span class="file-info__value" data-v-3d1acb3e>${ssrInterpolate(__props.value)}</span></div></div>`);
    };
  }
});

const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("src/components/FileInfo.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const FileInfo = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-3d1acb3e"]]);

export { FileInfo as F };
