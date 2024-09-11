/*! For license information please see main.e32c79cf.js.LICENSE.txt */
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
`,en=Xt.header`
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
`,tn=Xt.div`
  flex: 1;
  position: relative;
  height: calc(100% - 25px);
  background-color: white;
  
`,nn=Xt.div`
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
`,rn=Xt.div`
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
`;let an=1;const on=e=>{let{buttons:t,onMaximize:n,onMinimize:i,onClose:a,maximized:o,resizable:s,isFocus:l}=e;const u={minimize:(0,r.jsx)("button",{className:"header__button header__button--minimize "+(l?"":"header__button--unfocused"),onMouseUp:i},"minimize"),maximize:(0,r.jsx)("button",{className:`header__button ${o?"header__button--maximized":"header__button--maximize"} ${l?"":"header__button--unfocused"} ${s?"":"header__button--disable"}`,onMouseUp:n},"maximize"),close:(0,r.jsx)("button",{className:"header__button header__button--close "+(l?"":"header__button--unfocused"),onMouseUp:a},"close")};return(0,r.jsx)(rn,{isFocus:l,children:t?t.map((e=>u[e])):Object.values(u)})},sn=(0,e.memo)((t=>{let{title:i,children:a,onClose:o,onMinimize:s,onToggleMaximize:l,onFocus:u,isFocused:c,isMinimized:A,maximized:d,useStyledWindow:f=!0}=t;const{windowRef:h,startDrag:p,startResize:g}=(()=>{const t=(0,e.useRef)(null),n=200,r=150,i=(e,t)=>{window.addEventListener("mousemove",e),window.addEventListener("mouseup",t)},a=(e,t)=>{window.removeEventListener("mousemove",e),window.removeEventListener("mouseup",t)};return{windowRef:t,startDrag:e=>{if(e.preventDefault(),!t.current)return;const n=t.current.querySelector("iframe");n&&(n.style.pointerEvents="none");const{clientX:r,clientY:o}=e,{offsetLeft:s,offsetTop:l}=t.current,u=e=>{if(!t.current)return;const n=Math.max(0,Math.min(window.innerWidth-t.current.offsetWidth,s+e.clientX-r)),i=Math.max(0,Math.min(window.innerHeight-t.current.offsetHeight,l+e.clientY-o));t.current.style.left=`${n}px`,t.current.style.top=`${i}px`},c=()=>{a(u,c),n&&(n.style.pointerEvents="auto")};i(u,c)},startResize:(e,o)=>{if(e.preventDefault(),!t.current)return;const s=t.current,{clientX:l,clientY:u}=e,{offsetWidth:c,offsetHeight:A,offsetLeft:d,offsetTop:f}=s;let h=c,p=A,g=d,m=f;const b=e=>{const t=e.clientX-l,i=e.clientY-u,a=c-n,b=A-r;o.includes("right")&&(h=Math.max(n,c+t)),o.includes("left")&&(t<=a&&d+t>=0?(h=c-t,g=d+t):t>a?(h=n,g=d+a):(g=0,h=d+c)),o.includes("bottom")&&(p=Math.max(r,A+i)),o.includes("top")&&(i<=b&&f+i>=0?(p=A-i,m=f+i):i>b?(p=r,m=f+b):(m=0,p=f+A)),h=Math.min(h,window.innerWidth-g),p=Math.min(p,window.innerHeight-m),s.style.width=`${h}px`,s.style.height=`${p}px`,o.includes("left")&&(s.style.left=`${g}px`),o.includes("top")&&(s.style.top=`${m}px`)};i(b,(()=>a(b,b)))}}})(),m=(0,e.useRef)(null),[b,y]=(0,e.useState)({top:0,left:0});(0,e.useEffect)((()=>{var e,t;const{innerWidth:n,innerHeight:r}=window,i=(null===(e=h.current)||void 0===e?void 0:e.offsetWidth)||1200,a={top:(r-((null===(t=h.current)||void 0===t?void 0:t.offsetHeight)||700))/2,left:(n-i)/2};y(a),h.current&&(h.current.style.top=`${a.top}px`,h.current.style.left=`${a.left}px`)}),[h]),(0,e.useEffect)((()=>{c&&(an+=1,h.current.style.zIndex=an)}),[c,h]),(0,e.useEffect)((()=>{if(!f||!h.current)return;const e=h.current;d?(m.current||(m.current={width:e.style.width,height:e.style.height,top:e.style.top,left:e.style.left,position:e.style.position,maxWidth:e.style.maxWidth,maxHeight:e.style.maxHeight}),Object.assign(e.style,{position:"fixed",top:"0",left:"0",width:"100vw",height:"calc(100vh - 30px)",maxWidth:"100vw",maxHeight:"calc(100vh - 30px)"})):m.current&&(Object.assign(e.style,m.current),m.current=null)}),[d,f,h]);const w=()=>{c||(an+=1,h.current.style.zIndex=an,u())},v={ref:h,onMouseDown:w,style:b?{top:`${b.top}px`,left:`${b.left}px`}:{}};return f?(0,r.jsxs)($t,{...v,isFocused:c,isMinimized:A,children:[(0,r.jsxs)(en,{onMouseDown:p,onDoubleClick:()=>{l&&l()},isFocused:c,children:[(0,r.jsx)("img",{src:n(i),alt:i,className:"app__header__icon",draggable:!1}),(0,r.jsx)("div",{className:"app__header__title",children:i}),(0,r.jsx)(on,{onMinimize:s,onMaximize:l,onClose:o,isFocus:c,maximized:d,resizable:!0})]}),(0,r.jsx)(tn,{children:e.cloneElement(a,{isFocused:c,onFocus:w})}),(0,r.jsx)(nn,{className:"top-left",onMouseDown:e=>g(e,"top left")}),(0,r.jsx)(nn,{className:"top-right",onMouseDown:e=>g(e,"top right")}),(0,r.jsx)(nn,{className:"bottom-left",onMouseDown:e=>g(e,"bottom left")}),(0,r.jsx)(nn,{className:"bottom-right",onMouseDown:e=>g(e,"bottom right")}),(0,r.jsx)(nn,{className:"top",onMouseDown:e=>g(e,"top")}),(0,r.jsx)(nn,{className:"right",onMouseDown:e=>g(e,"right")}),(0,r.jsx)(nn,{className:"bottom",onMouseDown:e=>g(e,"bottom")}),(0,r.jsx)(nn,{className:"left",onMouseDown:e=>g(e,"left")})]}):(0,r.jsx)("div",{...v,children:e.cloneElement(a,{isFocused:c,onFocus:w})})})),ln="LoadingScreen_loadingScreenContainer__36krF",un="LoadingScreen_window__Th1yb",cn="LoadingScreen_container__iIB1Z",An="LoadingScreen_box__kpmSx",dn="LoadingScreen_logo__yX0FD",fn="LoadingScreen_microsoftWithIcon__BNk5J",hn="LoadingScreen_top__TXIrf",pn="LoadingScreen_xpIcon__JbNm4",gn="LoadingScreen_mid__L-NRu",mn="LoadingScreen_clickText__n9DtP",bn=e=>{let{onClick:t}=e;return(0,r.jsx)("div",{className:ln,onClick:t,children:(0,r.jsxs)("div",{className:un,children:[(0,r.jsxs)("div",{className:dn,children:[(0,r.jsxs)("div",{className:fn,children:[(0,r.jsx)("p",{className:hn,children:"Microsoft"}),(0,r.jsx)("img",{src:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEMCAMAAABJD3txAAAC+lBMVEVHcExmXULQphnmuhzfthb2pWboXiTjfB9kVT/4tHr5t375u4P4snf3r3P3rHD3qWv2pWf1n170mFPzkkvyi03whEbqYyLqZiP1o2P0m1rzklTyikLwfUDtbTPrYyHudzvtcjf7ayLtaDDivwnPlSXsYyzpUiLrXSnqWCboTCLwfjTmRyPucynwgzrcLiXveS/kQSPtMSfnNyTtaB/tbiPjPCTrZR/hNiTgMiTfLiXeJyXdIyXXIiXOJSU/NzvEJyW5KiVyIBOuKySHJx2iLSWbLCQ6QjeKKB5YGAWJ0gqI0gqU5AmI0QpjHw2J0wtCfToyM0R5uBVBZDhKnDpVgio+cTY3N0RCbjQMlEI4dDczdzgHj0JmmyAgkz8rezkifTsYfzwOgj0kmUA6VkBDQkIAjEFEjjpIlTpDREJHRUYChT4AkEIAiT9GkjpKmDpBjzlDPkNDQkKLLh1LmzpCizoAlkZPoToAl0YAk0RSpTpCjTlDQkIDnkVOnjpUqDkAlEVZsTlVqzkAlUVXrjkfpz8tqT44qj1ErDxRrzoTpUBMrTtEPTrHfku7ZTOXeyl9ai5yJgxRFgBFEABQFQBid7ems96So9Ohsdufr9qbq9iXqNaTpNSQodKMntGJm86Fl81vhMJXbLGjstyruuF3isWott6Bk8p8j8hyhsJpfrxLYKhug8BqgL5iebpKYKhlfbxddbhZcbVSabBVbbJPZq1MYqpJXqdGW6VFWaNBU58+Tps7Spc4RpQ1QpIyP48xPYgwPIAkKV4vOXYtNWwnLWLs0gPZuwfUoRzjwAbWugfDhyXOjiYkKl/fxwK6eSm9fybIhiUUFk3Pmh/AgybRnR/FiyTOlyHHjiP/zgD/2wA4OkbIkSLKkiL4xgD/0AD+zABoXDbXpBv+0gD/1QDlsw3ZphnMlSG5mhjcqRf7yQD/zwDfrBVUTjzirxH/0gCoiiHruAXxvwD2wwDotgjtuwFYY5gXG1YDAkAAADEBAD0AADoAADsBATwAADuuI9fOAAAA/nRSTlMAFyxWdK99SAr/////////////////xab////////f/////5TN////////////0f///+7//////////////0L//3b/sv//LNuPW5D/yFX6/l3//7r//3f/0P//qv+H/////2D/5f////7//////////5b6///////////P////////////////////s//////////ZL02UyP//////////x17//////////4n///+4///////////Z////////////uP//9f/a/7P8///Z/////ZH/////////////////////1v///////////////////////////////+3Sr20OBAAAAB9gSURBVHgB7NYFktswGIbhmJnDrLBhIWi6/70qWGs2KnMr5zvCM/+rUedPTRBFSZKVd1NlSRMFvfPYeyUJyhimRWbajuv5fgAXhlG31+sPVE18kHUEDZ6S7yIoYmUQqWEwGo3H4y6kgptMp7M5FGsxGLqn0dDDc2wbX5Z5h9VFWNPpYrGEA2AFwcRWXtR6EwV4vu95rmMb+LoMw3FdD1oFo5AcFsGazVar7XYLwK7fMi9RHUyiEG8UDIdvWKbJHhbFWkIsaLU/HA67wyFuj5em9pMJXBRFyCoY+j60ckiFxucqxIe13x92u10cx7t0oLVBap4lSfL0hLBCgnVfoc1WSLHwZWGrOE3j+FkV+K5vDgDIXl4o1uj7Kmyw0jR9fY2PJ265BLV/BuB8yRAWtqJYtEIW63MVIiw0yCXymN/gAqXgENYXK3S+XmFKsK5wfF0Xze98O2MspsLgcxWOmApXTIUYK8+PkEvn6ahuANxub1YXtkKK9V0VNlZ5URTHZ40bK3RUaOdbU2FyV6H/+QpZLLZCbFWWx+MzJ0+XCm5k568/WcxhfaVCilVVx4qPFvsN1o1WyHwcXFrhd3wcaIUlwqorLloUbmdKdftshRjLNGmFxOrrT1bRYNX1B27MAjXCIIrBLFJ3d7TuXXd31/sfpaz8Qygjj3r2AithvrwksQT/41pUFIZsFK54JXpz88MtVCXaTOFYrEQymXxKkYt1qMQyUbj5KQpfPAqVWOlMJpOltyx8WAIKt7axREspHIuVy2XyPuY8GpLfwjGFsviuozA9FqtQKJb4g8NYrdAPUBhBCsdaFUvklgXxfUwhTFlHHoU4ZX2ewkKxkOfVaunCD8fQWaK/QKEnVpY/OOAt/PqUpbcsoJDbsvxgWfYp6wjE+gSF5XkIDn7/d1OIYiWUWBXyrgMp6zMUQom+clJYSNFblmXK2nBPWedaCqFEq+BQLJaX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",alt:"XP Logo",className:pn})]}),(0,r.jsxs)("p",{className:gn,children:["Windows",(0,r.jsx)("span",{children:"XP"})]})]}),(0,r.jsxs)("div",{className:cn,children:[(0,r.jsx)("div",{className:An}),(0,r.jsx)("div",{className:An}),(0,r.jsx)("div",{className:An})]}),(0,r.jsx)("p",{className:mn,children:"Click anywhere to start ..."})]})})},yn="WelcomeScreen_welcomeScreen__iSDoI",wn="WelcomeScreen_topBar__GYIA9",vn="WelcomeScreen_bottomBar__iqyYE",En="WelcomeScreen_middleSection__HK2qN",kn="WelcomeScreen_fullCircle__8B7ZR",xn="WelcomeScreen_welcomeMessage__6ym4G",Sn=()=>(0,r.jsxs)("div",{className:yn,children:[(0,r.jsx)("div",{className:wn}),(0,r.jsxs)("div",{className:En,children:[(0,r.jsx)("div",{className:kn}),(0,r.jsx)("p",{className:xn,children:"welcome"})]}),(0,r.jsx)("div",{className:vn})]}),On=__webpack_require__.p+"static/media/startup.2d0dbc795c637e2bd8ec.mp3",Cn="LOADING",In="WELCOME",Bn="MAIN";const Tn=function(){var t;const[n,a]=(0,e.useState)(Cn),s=(0,e.useRef)(null),l=()=>{a(In)};(0,e.useEffect)((()=>{if(n===In){const e=setTimeout((()=>{a(Bn)}),3e3);return()=>clearTimeout(e)}}),[n]),(0,e.useEffect)((()=>{n===Bn&&s.current&&(s.current.volume=.25,console.log("Attempting to play audio..."),s.current.play().then((()=>{console.log("Audio played successfully")})).catch((e=>{console.error("Failed to play audio:",e)})))}),[n]);const u=__webpack_require__(1900),c=u.keys().map((e=>{const t=e.split("/"),n=t[t.length-2],r=t[t.length-1].replace(".js","");if(r===n){return{name:r,component:u(e).default}}return null})).filter(Boolean),A=["Winamp"],d=["Winamp"].map((e=>({name:e,id:Date.now(),maximized:!1}))),[f,h]=(0,e.useState)(d),[p,g]=(0,e.useState)([]),[m,b]=(0,e.useState)((null===(t=d[0])||void 0===t?void 0:t.id)||null),y=e=>{const t={name:e,id:Date.now(),maximized:!1};h((e=>[...e,t])),b(t.id),g((e=>e.filter((e=>e!==t.id))))},w=e=>{h((t=>t.filter((t=>t.id!==e)))),g((t=>t.filter((t=>t!==e)))),m===e&&b(null)},v=e=>{g((t=>[...t,e])),m===e&&b(null)},E=e=>{g((t=>t.filter((t=>t!==e)))),b(e),h((t=>t.map((t=>t.id===e?{...t,isMinimized:!1}:t))))},k=(e,t)=>{const n=c.find((t=>t.name===e));if(!n)return null;const i=n.component;return(0,r.jsx)(i,{onClose:()=>w(t),onMinimize:()=>v(t),isMinimized:p.includes(t)})};switch(n){case Cn:return(0,r.jsx)("div",{onClick:l,children:(0,r.jsx)(bn,{})});case In:return(0,r.jsx)(Sn,{});default:return(0,r.jsxs)("div",{className:"App",children:[(0,r.jsx)("audio",{ref:s,src:On}),(0,r.jsx)(i,{apps:c,openApplication:y,setFocusedApp:b}),(0,r.jsx)(o,{openApps:f,restoreApplication:E,minimizeApplication:v,focusedApp:m}),f.map((e=>{let{name:t,id:n,maximized:i}=e;return(0,r.jsx)(sn,{title:t,onClose:()=>w(n),onMinimize:()=>v(n),onToggleMaximize:()=>{return e=n,h((t=>t.map((t=>t.id===e?{...t,maximized:!t.maximized}:t)))),void b(e);var e},onFocus:()=>{b(n)},maximized:i,isFocused:m===n,isMinimized:p.includes(n),useStyledWindow:!A.includes(t),children:k(t,n)},n)}))]})}},Mn=e=>{e&&e instanceof Function&&__webpack_require__.e(488).then(__webpack_require__.bind(__webpack_require__,2488)).then((t=>{let{getCLS:n,getFID:r,getFCP:i,getLCP:a,getTTFB:o}=t;n(e),r(e),i(e),a(e),o(e)}))};t.createRoot(document.getElementById("root")).render((0,r.jsx)(e.StrictMode,{children:(0,r.jsx)(Tn,{})})),Mn()})()})();
//# sourceMappingURL=main.e32c79cf.js.map