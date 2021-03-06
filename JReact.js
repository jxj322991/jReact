let childrenSymbol = Symbol("children");

// 宿主组件（如div，span等）
class ElementWrapper {
  constructor(type) {
    this.type = type;
    this.props = Object.create(null);
    this[childrenSymbol] = [];
    this.children = [];
  }
  setAttribute (name, value) {
    this.props[name] = value;
  }
  // get children() {
  //   return this.children.map(child => child.vdom);
  // }
  appendChild (vchild) {
    this[childrenSymbol].push(vchild);
    this.children.push(vchild.vdom);
  }
  get vdom () {
    return this;
  }
  mountTo (range) {
    this.range = range;
    let placeholder = document.createComment("placeholder");
    let endRange = document.createRange();
    endRange.setStart(range.endContainer, range.endOffset);
    endRange.setEnd(range.endContainer, range.endOffset);
    endRange.insertNode(placeholder);
    range.deleteContents();
    let element = document.createElement(this.type);
    for (let name in this.props) {
      let value = this.props[name];
      if (name.match(/^on([\s\S]+)$/)) {
        let eventName = RegExp.$1.replace(/^[\s\S]/, (s) => s.toLowerCase());
        element.addEventListener(eventName, value);
      }
      if (name === "className") {
        element.setAttribute("class", value);
      }
      element.setAttribute(name, value);
    }
    for (let child of this.children) {
      let range = document.createRange();
      if (element.children.length) {
        range.setStartAfter(element.lastChild);
        range.setEndAfter(element.lastChild);
      } else {
        range.setStart(element, 0);
        range.setEnd(element, 0);
      }
      child.mountTo(range);
    }
    range.insertNode(element);

  }
  update () {

  }
}
// 宿主组件 (text)
class TextWrapper {
  constructor(content) {
    this.root = document.createTextNode(content);
    this.type = "#text";
    this.children = [];
    this.props = Object.create(null);
  }
  mountTo (range) {
    this.range = range;
    range.deleteContents();
    range.insertNode(this.root);
  }
  get vdom () {
    return this;
  }
}

// React 组件元素
export class Component {
  constructor() {
    this.children = [];
    this.props = Object.create(null);
  }
  get type () {
    return this.constructor.name;
  }
  setAttribute (name, value) {
    this.props[name] = value;
    this[name] = value;
  }
  mountTo (range) {
    this.range = range;
    this.update();
  }
  update () {
    let vdom = this.vdom;
    if (this.oldVdom) {
      const isSameNode = (node1, node2) => {
        if (!node1 || !node2) {
          return false
        }
        if (node1.type !== node2.type) {
          return false;
        }
        for (let name in node1.props) {
          if (
            typeof node1.props[name] === "object" &&
            typeof node2.props[name] === "object" &&
            JSON.stringify(node1.props[name]) ===
            JSON.stringify(node2.props[name])
          ) {
            continue;
          }
          if (node1.props[name] !== node2.props[name]) {
            return false;
          }
        }
        if (
          Object.keys(node1.props).length !== Object.keys(node2.props).length
        ) {
          return false;
        }
        return true;
      };
      const isSameTree = (node1, node2) => {
        if (!isSameNode(node1, node2)) {
          return false;
        }
        if (node1.children.length !== node2.children.length) {
          return false;
        }
        for (let i = 0; i < node1.children.length; i++) {
          if (!isSameTree(node1.children[i], node2.children[i])) {
            return false;
          }
        }
        return true;
      };
      const replace = (newTree, oldTree, indent) => {
        // console.log(indent + "new:", newTree);
        // console.log(indent + "old:", oldTree);
        if (!newTree || !oldTree) {
          return;
        }
        if (isSameTree(newTree, oldTree)) {
          // console.log("all the same");
          return;
        }
        if (!isSameNode(newTree, oldTree)) {
          // console.log("all different");
          newTree.mountTo(oldTree.range);
        } else {
          for (let i = 0; i < newTree.children.length; i++) {
            replace(newTree.children[i], oldTree.children[i], "  " + indent);
          }
        }
      };
      replace(vdom, this.oldVdom, "");
    } else {
      vdom.mountTo(this.range);
    }
    this.oldVdom = vdom;
  }
  get vdom () {
    return this.render().vdom;
  }
  appendChild (vchild) {
    return this.children.push(vchild);
  }
  setState (state) {
    const merge = (oldState, newState) => {
      for (let p in newState) {
        if (typeof newState[p] === "object" && newState[p] !== null) {
          if (typeof oldState[p] !== "object") {
            if (newState[p] instanceof Array) {
              oldState[p] = [];
            } else {
              oldState[p] = {};
            }
          }
          merge(oldState[p], newState[p]);
        } else {
          oldState[p] = newState[p];
        }
      }
    };
    if (!this.state && state) {
      this.state = {};
    }
    merge(this.state, state);
    // console.log(this.state);
    this.update();
  }
}

// React
export const JReact = {
  // Babel 会把 JSX 转译成一个名为 React.createElement() 的函数调用。
  // <h1 id=“myid” class=“myclass”>我是帅哥</h1>
  // const myh1=React.createElement("h1",{id:"myid",class:"myclass"},"我是帅哥")
  createElement (type, attributes, ...children) {
    console.log('createElement', arguments);
    let element;
    if (typeof type === "string") {
      element = new ElementWrapper(type);
    } else {
      element = new type();
    }
    for (let name in attributes) {
      element.setAttribute(name, attributes[name]);
    }
    const insertChildren = (children) => {
      for (let child of children) {
        if (typeof child === "object" && child instanceof Array) {
          insertChildren(child);
        } else {
          if (child === null || child === void 0) {
            child = "";
          }
          if (
            !(child instanceof Component) &&
            !(child instanceof ElementWrapper) &&
            !(child instanceof TextWrapper)
          ) {
            child = String(child);
          }
          if (typeof child === "string") {
            child = new TextWrapper(child);
          }
          element.appendChild(child);
        }
      }
    };
    insertChildren(children);
    return element;
  },
  // 源码位置：packages/react-dom/src/client/ReactDOM.js
  // render: function (element, container, callback) {
  render (element, container) {
    console.log('render', arguments)
    // 返回一个 Range 对象
    // Range 接口表示一个包含节点与文本节点的一部分的文档片段
    let range = document.createRange();
    if (container.children.length) {
      // Range.setStartAfter()
      // 以其它节点为基准，设置 Range 的起点。
      range.setStartAfter(container.lastChild);
      // Range.setEndAfter()
      // 以其它节点为基准，设置 Range 的终点。
      range.setEndAfter(container.lastChild);
    } else {
      range.setStart(container, 0);
      range.setEnd(container, 0);
    }
    element.mountTo(range);
  },
};
