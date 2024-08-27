/*! For license information please see main.c1430b7a.js.LICENSE.txt */
  display: ${e=>{let{isMinimized:t}=e;return t?"none":"flex"}};
  position: absolute;
  padding: ${e=>{let{header:t}=e;return null!==t&&void 0!==t&&t.invisible?0:3}}px;
  background-color: ${e=>{let{isFocused:t}=e;return t?"#0831d9":"#6582f5"}};
  flex-direction: column;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  width: ${e=>{let{width:t}=e;return t||"1200px"}};
  height: ${e=>{let{height:t}=e;return t||"700px"}};
  max-width: 100vw;
  max-height: 100vh;
  overflow: hidden;
`,$t=Zt.header`
  display: flex;
  height: 25px;
  font-weight: 700;
  font-size: 12px;
  font-family: 'Noto Sans';
  text-shadow: 1px 1px #000;
  color: white;
  position: relative;
  padding: 0 3px;
  align-items: center;
  background: ${e=>{let{isFocused:t}=e;return t?"linear-gradient(to bottom,#0058ee 0%,#3593ff 4%,#288eff 6%,#127dff 8%,#036ffc 10%,#0262ee 14%,#0057e5 20%,#0054e3 24%,#0055eb 56%,#005bf5 66%,#026afe 76%,#0062ef 86%,#0052d6 92%,#0040ab 94%,#003092 100%)":"linear-gradient(to bottom, #7697e7 0%,#7e9ee3 3%,#94afe8 6%,#97b4e9 8%,#82a5e4 14%,#7c9fe2 17%,#7996de 25%,#7b99e1 56%,#82a9e9 81%,#80a5e7 89%,#7b96e1 94%,#7a93df 97%,#abbae3 100%)"}};
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  overflow: hidden;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }


  .app__header__icon {
    width: 15px;
    height: 15px;
    margin-left: 1px;
    margin-right: 3px;
  }

  .app__header__title {
    flex: 1;
    padding-right: 5px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`,en=Zt.div`
  flex: 1;
  position: relative;
  height: calc(100% - 25px);
  background-color: white;
  
`,tn=Zt.div`
  position: absolute;
  background-color: transparent;
  z-index: 3;

  &.top-left,
  &.top-right,
  &.bottom-left,
  &.bottom-right {
    width: 15px;
    height: 15px;
  }

  &.top-left {
    top: 0;
    left: 0;
    cursor: nwse-resize;
  }

  &.top-right {
    top: 0;
    right: 0;
    cursor: nesw-resize;
  }

  &.bottom-left {
    bottom: 0;
    left: 0;
    cursor: nesw-resize;
  }

  &.bottom-right {
    bottom: 0;
    right: 0;
    cursor: nwse-resize;
  }

  &.top,
  &.bottom {
    width: calc(100% - 30px);
    height: 10px;
    left: 15px;
    cursor: ns-resize;
  }

  &.top {
    top: 0;
  }

  &.bottom {
    bottom: 0;
  }

  &.left,
  &.right {
    height: calc(100% - 30px);
    width: 10px;
    top: 15px;
    cursor: ew-resize;
  }

  &.left {
    left: 0;
  }

  &.right {
    right: 0;
  }
`,nn=Zt.div`
  opacity: ${e=>{let{isFocus:t}=e;return t?1:.6}};
  height: 22px;
  display: flex;
  align-items: center;
  margin-top: -1px;
  margin-right: 1px;
  
  .header__button {
    margin-right: 1px;
    position: relative;
    width: 22px;
    height: 22px;
    border: 1px solid #fff;
    border-radius: 3px;
    min-width: 0 !important;
    min-height: 0 !important;
    padding: 0 !important;
    &:hover {
      filter: brightness(120%);
    }
    &:hover:active {
      filter: brightness(90%);
    }
  }
  
  .header__button--minimize {
    box-shadow: inset 0 -1px 2px 1px #4646ff;
    background-image: radial-gradient(
      circle at 90% 90%,
      #0054e9 0%,
      #2263d5 55%,
      #4479e4 70%,
      #a3bbec 90%,
      white 100%
    );
    &:before {
      content: '';
      position: absolute;
      left: 4px;
      top: 13px;
      height: 3px;
      width: 8px;
      background-color: white;
    }
  }
  
  .header__button--maximize {
    box-shadow: inset 0 -1px 2px 1px #4646ff;
    background-image: radial-gradient(
      circle at 90% 90%,
      #0054e9 0%,
      #2263d5 55%,
      #4479e4 70%,
      #a3bbec 90%,
      white 100%
    );
    &:before {
      content: '';
      position: absolute;
      display: block;
      left: 4px;
      top: 4px;
      box-shadow: inset 0 3px white, inset 0 0 0 1px white;
      height: 12px;
      width: 12px;
    }
  }
  
  .header__button--maximized {
    box-shadow: inset 0 -1px 2px 1px #4646ff;
    background-image: radial-gradient(
      circle at 90% 90%,
      #0054e9 0%,
      #2263d5 55%,
      #4479e4 70%,
      #a3bbec 90%,
      white 100%
    );
    &:before {
      content: '';
      position: absolute;
      display: block;
      left: 7px;
      top: 4px;
      box-shadow: inset 0 2px white, inset 0 0 0 1px white;
      height: 8px;
      width: 8px;
    }
    &:after {
      content: '';
      position: absolute;
      display: block;
      left: 4px;
      top: 7px;
      box-shadow: inset 0 2px white, inset 0 0 0 1px white, 1px -1px #136dff;
      height: 8px;
      width: 8px;
      background-color: #136dff;
    }
  }
  
  .header__button--close {
    box-shadow: inset 0 -1px 2px 1px #da4600;
    background-image: radial-gradient(
      circle at 90% 90%,
      #cc4600 0%,
      #dc6527 55%,
      #cd7546 70%,
      #ffccb2 90%,
      white 100%
    );
    &:before {
      content: '';
      position: absolute;
      left: 9px;
      top: 2px;
      transform: rotate(45deg);
      height: 16px;
      width: 2px;
      background-color: white;
    }
    &:after {
      content: '';
      position: absolute;
      left: 9px;
      top: 2px;
      transform: rotate(-45deg);
      height: 16px;
      width: 2px;
      background-color: white;
    }
  }
  
  .header__button--disable {
    outline: none;
    opacity: 0.5;
    &:hover {
      filter: brightness(100%);
    }
  }
`;let rn=1;const an=e=>{let{buttons:t,onMaximize:n,onMinimize:i,onClose:a,maximized:o,resizable:s,isFocus:l}=e;const u={minimize:(0,r.jsx)("button",{className:"header__button header__button--minimize "+(l?"":"header__button--unfocused"),onMouseUp:i},"minimize"),maximize:(0,r.jsx)("button",{className:`header__button ${o?"header__button--maximized":"header__button--maximize"} ${l?"":"header__button--unfocused"} ${s?"":"header__button--disable"}`,onMouseUp:n},"maximize"),close:(0,r.jsx)("button",{className:"header__button header__button--close "+(l?"":"header__button--unfocused"),onMouseUp:a},"close")};return(0,r.jsx)(nn,{isFocus:l,children:t?t.map((e=>u[e])):Object.values(u)})},on=(0,e.memo)((t=>{let{title:i,children:a,onClose:o,onMinimize:s,onToggleMaximize:l,onFocus:u,isFocused:c,isMinimized:A,maximized:d,useStyledWindow:f=!0}=t;const{windowRef:h,startDrag:p,startResize:g}=(()=>{const t=(0,e.useRef)(null),n=200,r=150,i=(e,t)=>{window.addEventListener("mousemove",e),window.addEventListener("mouseup",t)},a=(e,t)=>{window.removeEventListener("mousemove",e),window.removeEventListener("mouseup",t)};return{windowRef:t,startDrag:e=>{if(e.preventDefault(),!t.current)return;const n=t.current.querySelector("iframe");n&&(n.style.pointerEvents="none");const{clientX:r,clientY:o}=e,{offsetLeft:s,offsetTop:l}=t.current,u=e=>{if(!t.current)return;const n=Math.max(0,Math.min(window.innerWidth-t.current.offsetWidth,s+e.clientX-r)),i=Math.max(0,Math.min(window.innerHeight-t.current.offsetHeight,l+e.clientY-o));t.current.style.left=`${n}px`,t.current.style.top=`${i}px`},c=()=>{a(u,c),n&&(n.style.pointerEvents="auto")};i(u,c)},startResize:(e,o)=>{if(e.preventDefault(),!t.current)return;const s=t.current,{clientX:l,clientY:u}=e,{offsetWidth:c,offsetHeight:A,offsetLeft:d,offsetTop:f}=s;let h=c,p=A,g=d,m=f;const b=e=>{const t=e.clientX-l,i=e.clientY-u,a=c-n,b=A-r;o.includes("right")&&(h=Math.max(n,c+t)),o.includes("left")&&(t<=a&&d+t>=0?(h=c-t,g=d+t):t>a?(h=n,g=d+a):(g=0,h=d+c)),o.includes("bottom")&&(p=Math.max(r,A+i)),o.includes("top")&&(i<=b&&f+i>=0?(p=A-i,m=f+i):i>b?(p=r,m=f+b):(m=0,p=f+A)),h=Math.min(h,window.innerWidth-g),p=Math.min(p,window.innerHeight-m),s.style.width=`${h}px`,s.style.height=`${p}px`,o.includes("left")&&(s.style.left=`${g}px`),o.includes("top")&&(s.style.top=`${m}px`)};i(b,(()=>a(b,b)))}}})(),m=(0,e.useRef)(null),[b,w]=(0,e.useState)({top:0,left:0});(0,e.useEffect)((()=>{var e,t;const{innerWidth:n,innerHeight:r}=window,i=(null===(e=h.current)||void 0===e?void 0:e.offsetWidth)||1200,a={top:(r-((null===(t=h.current)||void 0===t?void 0:t.offsetHeight)||700))/2,left:(n-i)/2};w(a),h.current&&(h.current.style.top=`${a.top}px`,h.current.style.left=`${a.left}px`)}),[h]),(0,e.useEffect)((()=>{c&&(rn+=1,h.current.style.zIndex=rn)}),[c,h]),(0,e.useEffect)((()=>{if(!f||!h.current)return;const e=h.current;d?(m.current||(m.current={width:e.style.width,height:e.style.height,top:e.style.top,left:e.style.left,position:e.style.position,maxWidth:e.style.maxWidth,maxHeight:e.style.maxHeight}),Object.assign(e.style,{position:"fixed",top:"0",left:"0",width:"100vw",height:"calc(100vh - 30px)",maxWidth:"100vw",maxHeight:"calc(100vh - 30px)"})):m.current&&(Object.assign(e.style,m.current),m.current=null)}),[d,f,h]);const y=()=>{c||(rn+=1,h.current.style.zIndex=rn,u())},v={ref:h,onMouseDown:y,style:b?{top:`${b.top}px`,left:`${b.left}px`}:{}};return f?(0,r.jsxs)(Xt,{...v,isFocused:c,isMinimized:A,children:[(0,r.jsxs)($t,{onMouseDown:p,onDoubleClick:()=>{l&&l()},isFocused:c,children:[(0,r.jsx)("img",{src:n(i),alt:i,className:"app__header__icon",draggable:!1}),(0,r.jsx)("div",{className:"app__header__title",children:i}),(0,r.jsx)(an,{onMinimize:s,onMaximize:l,onClose:o,isFocus:c,maximized:d,resizable:!0})]}),(0,r.jsx)(en,{children:e.cloneElement(a,{isFocused:c,onFocus:y})}),(0,r.jsx)(tn,{className:"top-left",onMouseDown:e=>g(e,"top left")}),(0,r.jsx)(tn,{className:"top-right",onMouseDown:e=>g(e,"top right")}),(0,r.jsx)(tn,{className:"bottom-left",onMouseDown:e=>g(e,"bottom left")}),(0,r.jsx)(tn,{className:"bottom-right",onMouseDown:e=>g(e,"bottom right")}),(0,r.jsx)(tn,{className:"top",onMouseDown:e=>g(e,"top")}),(0,r.jsx)(tn,{className:"right",onMouseDown:e=>g(e,"right")}),(0,r.jsx)(tn,{className:"bottom",onMouseDown:e=>g(e,"bottom")}),(0,r.jsx)(tn,{className:"left",onMouseDown:e=>g(e,"left")})]}):(0,r.jsx)("div",{...v,children:e.cloneElement(a,{isFocused:c,onFocus:y})})}));const sn=function(){var t;const n=__webpack_require__(1900),o=n.keys().map((e=>{const t=e.split("/"),r=t[t.length-2],i=t[t.length-1].replace(".js","");if(i===r){return{name:i,component:n(e).default}}return null})).filter(Boolean),s=["Winamp"],l=["Winamp"].map((e=>({name:e,id:Date.now(),maximized:!1}))),[u,c]=(0,e.useState)(l),[A,d]=(0,e.useState)([]),[f,h]=(0,e.useState)((null===(t=l[0])||void 0===t?void 0:t.id)||null),p=e=>{c((t=>t.filter((t=>t.id!==e)))),d((t=>t.filter((t=>t!==e)))),f===e&&h(null)},g=e=>{d((t=>[...t,e])),f===e&&h(null)},m=(e,t)=>{const n=o.find((t=>t.name===e));if(!n)return null;const i=n.component;return(0,r.jsx)(i,{onClose:()=>p(t),onMinimize:()=>g(t),isMinimized:A.includes(t)})};return(0,r.jsxs)("div",{className:"App",children:[(0,r.jsx)(i,{apps:o,openApplication:e=>{const t={name:e,id:Date.now(),maximized:!1};c((e=>[...e,t])),h(t.id),d((e=>e.filter((e=>e!==t.id))))},setFocusedApp:h}),(0,r.jsx)(a,{openApps:u,restoreApplication:e=>{d((t=>t.filter((t=>t!==e)))),h(e),c((t=>t.map((t=>t.id===e?{...t,isMinimized:!1}:t))))},minimizeApplication:g,focusedApp:f}),u.map((e=>{let{name:t,id:n,maximized:i}=e;return(0,r.jsx)(on,{title:t,onClose:()=>p(n),onMinimize:()=>g(n),onToggleMaximize:()=>{return e=n,c((t=>t.map((t=>t.id===e?{...t,maximized:!t.maximized}:t)))),void h(e);var e},onFocus:()=>{h(n)},maximized:i,isFocused:f===n,isMinimized:A.includes(n),useStyledWindow:!s.includes(t),children:m(t,n)},n)}))]})},ln=e=>{e&&e instanceof Function&&__webpack_require__.e(488).then(__webpack_require__.bind(__webpack_require__,2488)).then((t=>{let{getCLS:n,getFID:r,getFCP:i,getLCP:a,getTTFB:o}=t;n(e),r(e),i(e),a(e),o(e)}))};t.createRoot(document.getElementById("root")).render((0,r.jsx)(e.StrictMode,{children:(0,r.jsx)(sn,{})})),ln()})()})();
//# sourceMappingURL=main.c1430b7a.js.map