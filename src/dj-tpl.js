!(function (window, DJname, DIRECTIVE_NAME_PRE, undefined) {
  var REG_BIND = /{{.+}}/;
  var REG_METAS = new RegExp(`(?:(?<!\\$)\\b(?!(?:(?:\\.?\\d)|\\$)))|(?:(?<!\\.)\\b(?=\\d))|(?:(?<!\\w)(?=\\$))|(?:(?<=\\$)(?!\\w))|(?:(?<=[\\+\\-\\*\\/\\[\\]\\(\\)]))|(?:(?=[\\[\\]\\(\\)\\+\\-\\!]))`);
  var REG_STRING_SPLIT = new RegExp(`(?<=(?:[^\\\\](?:\\\\\\\\)*)|^)'`);
  var REG_FOR = [
    { mode: "of", reg: /\s+of\s+/ },
    { mode: "in", reg: /\s+in\s+/ },
  ];
  var DIRECTIVE_NAME_FOR = DIRECTIVE_NAME_PRE + "for";
  var DIRECTIVE_NAME_IF = DIRECTIVE_NAME_PRE + "if";

  var slice = [].slice;
  var isArray = Array.isArray;
  function isUndefined(value) { return typeof value === 'undefined'; }
  function isDefined(value) { return typeof value !== 'undefined'; }
  function isObject(value) { return value !== null && typeof value === 'object'; }
  function isString(value) { return typeof value === 'string'; }
  function isNumber(value) { return typeof value === 'number'; }
  function isDate(value) { return toString.call(value) === '[object Date]'; }
  function isFunction(value) { return typeof value === 'function'; }
  function isRegExp(value) { return toString.call(value) === '[object RegExp]'; }
  function merge(dst) { return baseExtend(dst, slice.call(arguments, 1), true); }
  function extend(dst) { return baseExtend(dst, slice.call(arguments, 1), false); }
  function baseExtend(dst, objs, deep) {
    for (var i = 0, ii = objs.length; i < ii; ++i) {
      var obj = objs[i];
      if (!isObject(obj) && !isFunction(obj)) continue;
      var keys = Object.keys(obj);
      for (var j = 0, jj = keys.length; j < jj; j++) {
        var key = keys[j];
        var src = obj[key];
        if (deep && isObject(src)) {
          if (isDate(src)) {
            dst[key] = new Date(src.valueOf());
          } else if (isRegExp(src)) {
            dst[key] = new RegExp(src);
          } else {
            if (!isObject(dst[key])) dst[key] = isArray(src) ? [] : {};
            baseExtend(dst[key], [src], true);
          }
        } else {
          dst[key] = src;
        }
      }
    }
    return dst;
  }
  function equals(o1, o2) {
    if (o1 === o2) return true;
    if (o1 === null || o2 === null) return false;
    if (o1 !== o1 && o2 !== o2) return true;
    var keySet, t1 = typeof o1, t2 = typeof o2, length, key;
    if (t1 === t2 && t1 === 'object') {
      if (isArray(o1)) {
        if (!isArray(o2)) return false;
        if ((length = o1.length) === o2.length) {
          for (key = 0; key < length; key++) {
            if (!equals(o1[key], o2[key])) return false;
          }
          return true;
        }
      } else if (isDate(o1)) {
        if (!isDate(o2)) return false;
        return equals(o1.getTime(), o2.getTime());
      } else if (isRegExp(o1)) {
        if (!isRegExp(o2)) return false;
        return o1.toString() === o2.toString();
      } else {
        if (isArray(o2) || isDate(o2) || isRegExp(o2)) return false;
        keySet = {};
        for (key in o1) {
          if (isFunction(o1[key])) continue;
          if (!equals(o1[key], o2[key])) return false;
          keySet[key] = 1;
        }
        for (key in o2) {
          if (!(key in keySet) && isDefined(o2[key]) && !isFunction(o2[key])) return false;
        }
        return true;
      }
    }
    return false;
  }
  function copyof(v) {
    if (!v || !isObject(v) || isFunction(v)) return v;
    if (isArray(v)) return merge([], v);
    return merge({}, v);
  }

  /**
   * 解析器
   */
  var CParser = (function (undefined) {
    var MIN_OP = { level: 0 };
    function CParser(str) {
      this.str = str.trim();
      this.valueList = this.str && CParser.parse(this.str) || [];
    }
    CParser.prototype = {
      exec: function (scope, params) {
        var R, parser = new _Parser(scope, params);
        this.valueList.map(valueItem => {
          R = parser.calcValue(valueItem, scope, params)
        });
        return R;
      }
    }

    CParser.parse = function (expression) {
      var metas = parseMore(parseStringMetas(expression));
      var valueList = getValueList(metas, 0, ";");
      return valueList && valueList.pos >= metas.length && valueList.valueList || [];
    }

    CParser.parseTextBind = function (text) {
      var arr = (text || "").split(/{{|}}/);
      var metas = [new Meta("string", arr[0])];
      for (var i = 1, length = arr.length; i < length; i += 2) {
        metas.push(new Meta("operator", "+"));
        [].push.apply(metas, parseMore(parseStringMetas(`(${arr[i]})`)) || []);
        metas.push(new Meta("operator", "+"));
        metas.push(new Meta("string", arr[i + 1]));
      }
      var valueList = getValueList(metas, 0, ";");
      var parser = new CParser("");
      parser.str = text || "";
      parser.valueList = valueList && valueList.pos >= metas.length && valueList.valueList || [];
      return parser;
    }

    function _Parser(scope, params) {
      this.scope = scope;
      this.params = params || {};
    }
    _Parser.prototype = {
      calcValue: function (valueItem) {
        if (!(valueItem instanceof Meta)) return "";
        if (valueItem.isStatic()) return valueItem.value;
        if (valueItem.type == "var") {
          if (this.params.hasOwnProperty(valueItem.value)) return this.params[valueItem.value];
          return this.scope.$member(valueItem.value);
        }
        /** 求反 */
        if (valueItem.type == "!") {
          return !this.calcValue(valueItem.value);
        }
        if (valueItem.type == "-") {
          return -this.calcValue(valueItem.value);
        }
        if (valueItem.type == "+") {
          return +this.calcValue(valueItem.value);
        }
        /** 成员属性 */
        if (valueItem.type == "member") {
          var v1 = this.calcValue(valueItem.value.v1);
          if (!v1) return "";
          var v2 = this.calcValue(valueItem.value.v2);
          return v1[v2];
        }
        /** 函数 */
        if (valueItem.type == "call") {
          var value = valueItem.value || {};
          var caller = value.caller;
          if (!(caller instanceof Meta)) return "";
          var valueList = isArray(value.valueList) ? value.valueList.map(valueItem => this.calcValue(valueItem)) : [];
          if (caller.type == "var") {
            return this.scope.$memberCall(caller.value, valueList);
          } else if (caller.type == "member") {
            var v1 = this.calcValue(caller.v1);
            var v2 = this.calcValue(caller.v2);
            if (!v1 || !isFunction(v1[v2])) return "";
            return v1[v2].apply(v1, valueList);
          } else {
            return "";
          }
        }
        /** 算式 */
        if (valueItem.type == "calc") {
          var valueAndOperators = valueItem.value.map((meta, n) => {
            if (n & 1) {
              return CCalcu.findOperator(meta);
            }
            return this.calcValue(meta);
          });
          return CCalcu.calc(valueAndOperators);
        }
        return "";
      }
    }

    function Meta(type, value) {
      this.type = type;
      this.value = value;
    }
    Meta.prototype = {
      isStatic: function () { return this.type == "number" || this.type == "string"; },
      isOperator: function (value) { return this.type == "operator" && this.value == value; }
    }


    /**
     * 解析器运算类
     */
    function CCalcu(valueAndOperators) {
      this.valueAndOperators = valueAndOperators;
    }
    CCalcu.prototype = {
      calc: function () {
        var op, value;
        this.stack = { value: this.valueAndOperators[0], op: MIN_OP };
        this.pos = 1;
        for (var length = this.valueAndOperators.length, pos = 1; pos < length; pos += 2) {
          op = this.valueAndOperators[pos];
          value = this.valueAndOperators[pos + 1];
          this.stack = {
            pre: this.stack,
            op,
            value
          }
          this.calcPre();
        }
        // 结束，以一个最低级别符号入栈，即可
        this.stack = {
          pre: this.stack,
          op: MIN_OP
        }
        //@计算 总是发生在 this.stack.pre 节点上，
        this.calcPre();
        return this.stack.pre.value;
      },

      /**
       * 计算之前入栈的数据
       * 保持每个栈的 pre 的运算符优先级小于后面入栈的运算符
       * @思路 每次入栈，循环： @操作 { 如果新的优先级不超过前一栈，那就要把前一栈计算掉 }
       * @计算 总是发生在 this.stack.pre 节点上
       *   这样处理后，最后入栈的运算符优先级，一定是整个栈中最高的
       */
      calcPre: function () {
        var pre = this.stack.pre;
        if (!pre) return;
        if (!pre.pre || this.stack.op.level > pre.op.level) return;
        // 要计算到这里
        var prepre = pre.pre;
        // 进行计算
        prepre.value = pre.op.calc(prepre.value, pre.value);
        // pre为已计算的节点，结果已存并替换到prepre中，可以丢弃了
        this.stack.pre = prepre;
        // 其实，下面这个递归可以很方便地改为 while 循环
        this.calcPre();
      }
    }
    CCalcu.findOperator = function (str) {
      return this.operators.find(item => item.value == str);
    }

    CCalcu.isCalcOperator = function (str) {
      return !!(this.operators.find(item => item.value == str) || {}).level;
    }

    CCalcu.calc = function (valueAndOperators) {
      return new CCalcu(valueAndOperators).calc();
    }
    CCalcu.operators = [
      { value: ".", },
      { value: "!", },
      { value: "[", },
      { value: "]", },
      { value: "(", },
      { value: ")", },
      { value: "*", level: 90, calc: (a, b) => a * b },
      { value: "/", level: 90, calc: (a, b) => a / b },
      { value: "%", level: 90, calc: (a, b) => a % b },
      { value: "+", level: 80, calc: (a, b) => { return !isNumber(a) && isObject(b) ? a + (b && JSON.stringify(b) || "") : (!isNumber(b) && isObject(a) ? (a && JSON.stringify(a) || "") + b : a + b) } },
      { value: "-", level: 80, calc: (a, b) => a - b },
      { value: ">", level: 50, calc: (a, b) => a > b },
      { value: "<", level: 50, calc: (a, b) => a < b },
      { value: ">=", level: 50, calc: (a, b) => a >= b },
      { value: "<=", level: 50, calc: (a, b) => a <= b },
      { value: "==", level: 50, calc: (a, b) => a == b },
      { value: "!=", level: 50, calc: (a, b) => a != b },
      { value: "&&", level: 29, calc: (a, b) => a && b },
      { value: "||", level: 28, calc: (a, b) => a || b },
      { value: "^^", level: 27, calc: (a, b) => a ? !b : !!b },
      { value: ",", },
      { value: ";", },
    ];

    return CParser;

    /**
     * 解析字符串
     */
    function parseStringMetas(expression) {
      expression = expression.trim();
      if (!expression) return [];
      var metas = [], list, s;
      // 提取字符串
      list = expression.split(REG_STRING_SPLIT);
      for (var length = list.length, i = 0, strMode = 0; i < length; i++) {
        if (strMode == 0) {
          strMode = 1;
          s = list[i].trim();
          if (s) metas.push(s);
        }
        else if (strMode == 1) {
          if (i == length - 1) {
            throw ("string not closed.");
          }
          strMode = 0;
          metas.push(new Meta("string", list[i].replace(/\\([\\'])/g, '$1')));
        }
      }
      return metas;
    }

    /**
     * 解析其它
     */
    function parseMore(metas) {
      var newMetas = [], arr;
      metas.map(item => {
        if (item instanceof Meta) {
          newMetas.push(item);
        } else {
          arr = item.split(REG_METAS).map(s => s.trim()).filter(a => a);
          [].push.apply(newMetas, arr);
        }
      });
      return newMetas.map(item => {
        if (item instanceof Meta) return item;
        if (CCalcu.findOperator(item)) return new Meta("operator", item);
        if (!Number.isNaN(Number(item))) return new Meta("number", Number(item));
        return new Meta("var", item);
      })
    }

    /** */
    function getValueList(metas, posFrom, sep = ";") {
      var valueGetting;
      for (var pos = posFrom, valueList = []; ;) {
        valueGetting = getValue(metas, pos);
        if (!valueGetting) return { pos, valueList };
        if (valueGetting) {
          valueList.push(valueGetting.value);
        }
        pos = valueGetting.pos;
        if (!metas[pos] || !metas[pos].isOperator(sep)) return { pos, valueList };
        pos++;
      }
    }

    /** */
    function getValue(metas, posFrom, useCalcOperator = true) {
      var meta = metas[posFrom];
      if (!(meta instanceof Meta)) return false;
      var type = meta.type
      var value = meta.value
      if (meta.isStatic() || type == "var") {
        return getValueMore(metas, meta, posFrom + 1, useCalcOperator);
      }
      if (meta.isOperator(";")) {
        return getValue(metas, posFrom + 1);
      }
      if (meta.isOperator("-") || meta.isOperator("+") || meta.isOperator("!")) {
        var b = getValue(metas, posFrom + 1, false);
        if (!b) {
          throw ("value expected.");
        }
        var v1 = new Meta(value, b.value);
        return getValueMore(metas, v1, b.pos, useCalcOperator);
      }
      if (meta.isOperator("(")) {
        var b = getValue(metas, posFrom + 1);
        if (!b) {
          throw ("value expected.");
        }
        if (metas.length <= b.pos || !metas[b.pos].isOperator(")")) {
          throw ("“ ) ” expected.");
        }
        return getValueMore(metas, b.value, b.pos + 1, useCalcOperator);;
      }
      // 未知的元素
      return false;
    }

    /** */
    function getValueMore(metas, v1, posFrom, useCalcOperator) {
      var meta = metas[posFrom];
      if (!(meta instanceof Meta)) return { pos: posFrom, value: v1 };
      var type = meta.type
      if (type != "operator") {
        throw ("operator expected.");
      }
      var operator = meta.value

      // 算式操作
      if (useCalcOperator && CCalcu.isCalcOperator(operator)) {
        var b = getValue(metas, posFrom + 1, false);
        if (v1.type != "calc") {
          v1 = new Meta("calc", [v1]);
        }
        v1.value.push(operator);
        v1.value.push(b.value);
        return getValueMore(metas, v1, b.pos, useCalcOperator);
      }

      // 方括号形式成员
      if (operator == "[") {
        var b = getValue(metas, posFrom + 1);
        if (metas.length <= b.pos || metas[b.pos + 1].isOperator("]")) {
          throw ("“ ] ” expected.");
        }
        return getValueMore(metas, new Meta("member", { v1, v2: b.value }), b.pos + 1, useCalcOperator);
      }

      // 点号形式成员
      if (operator == ".") {
        if (metas.length <= posFrom + 1 || metas[posFrom + 1].type != "var") {
          throw ("member name expected.");
        }
        return getValueMore(metas, new Meta("member", { v1, v2: new Meta("string", metas[posFrom + 1].value) }), posFrom + 2, useCalcOperator);
      }

      // 函数调用
      if (operator == "(") {
        var paramsGetting = getValueList(metas, posFrom + 1, ",");
        if (metas.length <= paramsGetting.pos || !metas[paramsGetting.pos].isOperator(")")) {
          throw ("“ ) ” expected.");
        }
        return getValueMore(
          metas,
          new Meta("call", { caller: v1, valueList: paramsGetting.valueList }),
          paramsGetting.pos + 1,
          useCalcOperator
        );
      }

      // 未知，或者是语句结束
      return {
        pos: posFrom,
        value: v1
      }
    }
  })();

  /** 上下文类 */
  function Scope(parentScope) {
    this.$id = Scope.id = (Scope.id || 0) + 1;
    this.$parent = parentScope;
    this.$watcher = [];
    this.$childScope = [];
    parentScope && parentScope.$childScope.push(this);
  }
  Scope.prototype = {
    $destroy: function () {
      this.$watcher = [];
      this.$childScope.map(scope => scope.$destroy());
      this.$childScope = [];
      this.$parent && (this.$parent.$childScope = this.$parent.$childScope.filter(c => c != this));
      this.$parent = null;
    },

    $member: function (name) {
      if (this.hasOwnProperty(name)) return this[name];
      if (this.$parent) return this.$parent.$member(name);
      return "";
    },

    $memberCall: function (name, params) {
      if (isFunction(this[name])) return this[name].apply(this, params);
      if (this.$parent) return this.$parent.$memberCall(name, params);
      return "";
    },

    applyAll: function (onlyChild) {
      if (!onlyChild && this.$parent) return this.$parent.applyAll(onlyChild);
      this.apply();
      this.$childScope.map(scope => scope.applyAll(2));
    },

    apply: function () {
      if (this.$timerid) return;
      this.$timerid = setTimeout(() => {
        this.$watcher.map(watcher => watcher.applyCount = 0);
        //console.log("apply(运行), scope_id=", this.$id, ", timerid=", this.$timerid);
        for (var i = 0, clean = 0, length = this.$watcher.length; clean < length; i = (i + 1) % length) {
          var watcher = this.$watcher[i];
          var newValue = watcher.parser.exec(this, {});
          if (!equals(newValue, watcher.lastValue)) {
            if (watcher.applyCount > 5) throw ("apply for watcher exceed 5 times.");
            //console.log("apply (watcher), str=", watcher.parser.str, "newValue=", newValue, "lastValue=", watcher.lastValue, ", scope_id=", this.$id, ", timerid=", id);
            watcher.applyCount++;
            watcher.callback(newValue, watcher.lastValue);
            watcher.lastValue = copyof(newValue);
            clean = 0;
          } else {
            clean++;
          }
        }
        this.$timerid = 0;
        //console.log("apply(运行 end.), scope_id=", this.$id, ", timerid=", this.$timerid);
      })
    },

    $watch: function (parser, callback) {
      if (isString(parser)) parser = new CParser(parser);
      var watcher = { parser, callback };
      this.$watcher.push(watcher);
      return watcher;
    },

    $unwatch: function (watcher) {
      this.$watcher = this.$watcher.filter(w => w != watcher);
      return watcher;
    }
  };

  /**
   * 虚拟Dom类
   * @member {CVirtureDom} parent  父节点
   * @member {[CVirtureDom]} children  所有后代节点
   * @member {ObjectCompile} nodeName 节点类型，同DOM元素
   * @member {ObjectCompile} nodeValue nodeName=="#text"时有效，可能含有文本绑定配置
   * @member {[Object]} attributes 节点属性数组，每项均可能含有指令或文本绑定配置
   * @member {Object} vElements 虚拟Dom信息，可用于直接显示，可根据 document.body.contains(element) 识别是否在 body 中
   *     @property {HTMLElement} elememt 普通节点（非for/if）时，有此属性
   *     @property {Object} comment 动态节点（for/if） 时，有此属性
   *         @property {string} text 注释内容
   *         @property {HTMLElement} begin 动态节点的开始占位
   *         @property {HTMLElement} end 动态节点的结束占位
   *     @property {[Object]} list 动态节点列表，并行节点
   *         @property {CVirtureDom} vd 节点的虚拟对象
   *         @property {Scope} scope 节点的上下文对象，可能为空。若有，在节点删除时要销毁
   *         @property {HTMLElement} elememt 文档流中的实例
   */
  function CVirtureDom(parent) {
    this.$id = CVirtureDom.id = (CVirtureDom.id || 0) + 1;
    this.parent = parent;
    parent && parent.children.push(this);
    this.children = [];
    this.vElements = { list: [] };
    this._vElements = { list: [] };
  }
  CVirtureDom.prototype = {
    html: function (template) {
      var dom = document.createElement("div");
      dom.innerHTML = (template || "").trim();
      this.parseChildrenFrom(dom);
    },

    /**
     * 建立本元素的虚拟DOM自身数据
     * @param {HTMLElement} dom 
     */
    parseSelfFrom: function (dom) {
      this.nodeName = { isNodeName: true, name: dom.nodeName.toLowerCase() };
      this.nodeValue = { value: dom.nodeValue };
      this.attributes = [].map.call(dom.attributes || [], attr => {
        if (attr.name == "attr") this.nodeName.value = attr.value;
        return { name: attr.name, value: attr.value };
      });
    },

    /**
     * 建立后代元素的虚拟DOM
     * @param {HTMLElement} dom 
     */
    parseChildrenFrom: function (dom) {
      this.children = [];
      if (!dom.hasChildNodes()) return;
      var nodes = dom.childNodes;
      [].map.call(nodes || [], node => {
        if (node.nodeName.name == "#text" && !node.nodeValue.name.trim()) return;
        var vd = new CVirtureDom(this);
        vd.parseSelfFrom(node);
        vd.parseChildrenFrom(node);
      });
    },

    copyFrom: function (old) {
      this.nodeName = merge({}, old.nodeName);
      this.nodeValue = merge({}, old.nodeValue);
      this.attributes = merge([], old.attributes);
      this.children = [];
      old.children.map(vd => {
        var vdSub = new CVirtureDom(this);
        vdSub.copyFrom(vd);
      });
    },

    /**
     * @param {HTMLElement} rootDom 要进行显示的根节点
     * @param {Scope} scope 上下文
     * @param {boolean} childrenOnly 仅显示子元素部分，对属性等不进行解析
     */
    show: function (rootDom, scope, childrenOnly) {
      rootDom.innerHTML = "";
      var childScope = scope;
      !childrenOnly && this.attributes.concat(this.nodeName).map(attr => {
        !attr.isNodeName && rootDom.setAttribute(attr.name, attr.value || "");
        var compile = attr.compile;
        if (compile && compile.type == "Directive") {
          var directive = compile.directive;
          childScope = compile.scope || childScope;
          directive.link && directive.link(compile.scope || scope, rootDom, { parser: compile.parser, directive, vd: this });
          compile.scope && compile.scope.apply();
        } else if (compile && compile.type == "TextBind") {
          CVirtureDom.showTextBind(attr, scope, newValue => rootDom.setAttribute(attr.name, newValue));
        }
      });

      this.children.map(child => {
        var elememts = child.createElements();
        elememts.map(elememt => rootDom.append(elememt));
        this.showSubElements(child, elememts[0], childScope);
      });
    },

    /**
     * 使用上下文进行编译
     * @param {Scope} scope 上下文
     * @param {boolean} childrenOnly 仅显示子元素部分，对属性等不进行解析
     * 编译后，生成 vElement 数据，可一一对应生成实际的 dom
     * 各 vElement 数据中的指令，在显示(show)时，调用link, 以兑现指令功能
     */
    compileUseScope: function (scope, childrenOnly) {
      if (this.compileFor(scope) !== false) return;
      if (this.compileIf(scope) !== false) return;
      var templated = false;
      var childScope = scope;
      !childrenOnly && this.attributes.concat(this.nodeName).map(attr => {
        attr.compile = null;
        var directive = CVirtureDom.directiveList.find(directive => directive.name == attr.name);
        if (directive) {
          directive = directive.directive;
          if (isFunction(directive)) directive = directive(directive);
          if (isDefined(directive.restrict)) {
            if (!/E/i.test(directive.restrict) && attr.isNodeName) return;
            if (!/A/i.test(directive.restrict) && !attr.isNodeName) return;
          }
          var parser = directive.parser && directive.parser(attr.value) || new CParser(attr.value || "");
          if (directive.hasOwnProperty('template')) {
            if (templated) throw ("mulity template directive.");
            templated = true;
            this.html(directive.template);
            childScope = new Scope();
            scope.$watch(parser, newValue => (childScope.apply(), (childScope.$attr = newValue)));
            parser = new CParser("$attr");
          }
          attr.compile = {
            type: "Directive",
            directive,
            parser,
            scope: childScope
          };
        } else {
          CVirtureDom.compileTextBind(attr);
        }
      });
      CVirtureDom.compileTextBind(this.nodeValue);
      this.children.map(vdSub => vdSub.compileUseScope(childScope));
    },

    compileFor: function (parentScope) {
      var attr = this.attributes.find(attr => attr.name == DIRECTIVE_NAME_FOR);
      if (!attr) return false;
      var mode = REG_FOR.find(mode => mode.reg.test(attr.value));
      if (!mode) throw (DIRECTIVE_NAME_FOR + " directive grammar error");
      var str = attr.value.split(mode.reg).map(s => s.trim());
      var $key = str[0];
      var parser = new CParser(str[1]);
      attr.compile = {
        type: "Directive-for",
        parser,
      };
      this.vElements.comment = { text: `${DIRECTIVE_NAME_FOR}="${attr.value}"` };
      parentScope.$watch(parser, newValue => {
        // 备份 虚拟Dom信息
        this.backupCommentElements();
        // 重新生成 虚拟Dom信息
        for (var k in newValue) {
          var scope = new Scope(parentScope);
          if (mode.mode == "in") {
            scope[$key] = k;
          } else {
            scope.$key = k;
            scope[$key] = newValue[k];
          }
          var vd = new CVirtureDom(this.parent);
          vd.copyFrom(this);
          vd.attributes = vd.attributes.filter(attr => attr.name != DIRECTIVE_NAME_FOR);
          vd.compileUseScope(scope);
          this.vElements.list.push({ vd, scope });
        }
        // 更新 虚拟Dom信息
        this.updateCommentElements(parentScope);
      });
    },

    compileIf: function (parentScope) {
      var attr = this.attributes.find(attr => attr.name == DIRECTIVE_NAME_IF);
      if (!attr) return false;
      this.vElements.comment = { text: `${DIRECTIVE_NAME_IF}="${attr.value}"` };
      var parser = new CParser(attr.value);
      attr.compile = {
        type: "Directive-if",
        parser,
      };
      parentScope.$watch(parser, newValue => {
        // 备份 虚拟Dom信息
        this.backupCommentElements();
        // 重新生成 虚拟Dom信息
        if (newValue) {
          var scope = new Scope(parentScope);
          var vd = new CVirtureDom(this.parent);
          vd.copyFrom(this);
          vd.attributes = vd.attributes.filter(attr => attr.name != DIRECTIVE_NAME_IF);
          vd.compileUseScope(scope);
          this.vElements.list.push({ vd, scope });
        }
        // 更新 虚拟Dom信息
        this.updateCommentElements(parentScope);
      });
    },

    destoryCommentElements: function (where) {
      var comment = this.vElements.comment;
      if (!comment) return;
      var begin = comment.begin;
      var end = comment.end;
      if (begin && end) {
        while (begin.nextSibling && begin.nextSibling != end) {
          begin.nextSibling.remove();
        }
        (where || []).map(name => {
          ((this[name] || {}).list || []).map(vElement => {
            var vd = vElement.vd;
            vElement.scope && vElement.scope.$destroy();
            vElement.scope = null;
            vElement.elememt = null;
            vd.destoryCommentElements(["vElements", "_vElements"]);
          });
        });
      }
    },
    backupCommentElements: function () {
      this._vElements.list = this.vElements.list;
      this.vElements.list = [];
    },
    updateCommentElements: function (parentScope) {
      if (!this.vElements.comment || !this.vElements.comment.begin) return;
      CVirtureDom.cloneShow(this.vElements.comment.begin.parentNode, () => {
        // 删除位置前后内容
        this.destoryCommentElements(["_vElements"]);
        // 新加内容
        this.vElements.list.map(vElement => {
          var vd = vElement.vd;
          var elememts = vd.createElements();
          elememts.map(elememt => this.vElements.comment.end.before(elememt));
          this.showSubElements(vd, elememts[0], vElement.scope);
        });
        parentScope.applyAll(1);
      });
    },

    /**
     * @param {HTMLElement} rootDom 
     * @param {Scope} scope 
     */
    createElements: function () {
      var vElements = this.vElements;
      var comment = vElements.comment;
      if (comment && comment.text) {
        comment.begin = comment.begin || document.createComment(comment.text + " begin");
        comment.end = comment.end || document.createComment(comment.text + " end");
        return [comment.begin, comment.end]
      } else if (this.nodeName.name == "#text") {
        vElements.elememt = vElements.elememt || document.createTextNode(this.nodeValue.value || "");
        return [vElements.elememt];
      } else {
        vElements.elememt = vElements.elememt || document.createElement(this.nodeName.name);
        return [vElements.elememt];
      }
    },

    showSubElements: function (vd, elememt, scope) {
      if (vd.vElements.comment && vd.vElements.comment.text) return;
      if (vd.nodeName.name == "#text") {
        CVirtureDom.showTextBind(vd.nodeValue, scope, newValue => elememt.nodeValue = newValue);
      } else {
        vd.show(elememt, scope);
      }
    }
  }

  CVirtureDom.compileTextBind = function (obj) {
    if (!obj.value || !REG_BIND.test(obj.value)) return;
    obj.compile = {
      type: "TextBind",
      parser: CParser.parseTextBind(obj.value),
    };
  }
  CVirtureDom.showTextBind = function (obj, scope, callback) {
    if (!obj.compile || obj.compile.type != "TextBind") return;
    scope.$watch(obj.compile.parser, callback);
    callback(obj.value);
  }

  CVirtureDom.cloneShow = function (elementNode, callback) {
    if (elementNode.cloneShowing) return callback();
    elementNode.cloneShowing = true;
    var parentNode = elementNode.parentNode;
    var cloneNode = elementNode.cloneNode(true);
    parentNode.replaceChild(cloneNode, elementNode);
    callback();
    setTimeout(() => {
      parentNode.replaceChild(elementNode, cloneNode);
      elementNode.cloneShowing = false;
    });
  }

  CVirtureDom.directive = function (name, directive) {
    CVirtureDom.directiveList = CVirtureDom.directiveList || [];
    if (directive) {
      directive.$name = name;
      CVirtureDom.directiveList.push({ name, directive });
      return CVirtureDom;
    } else {
      return CVirtureDom.directiveList.find(d => d.name == name);
    }
  }

  CVirtureDom.component = function (name, directive) {
    return CVirtureDom.directive(name, extend({}, directive, { restrict: "E" }));
  }

  CVirtureDom
    .directive(DIRECTIVE_NAME_PRE + "click", {
      link: (scope, elememt, param) => {
        elememt.addEventListener("click", $event => {
          param.parser.exec(scope, { $event });
          scope.applyAll();
        });
      }
    })
    .directive(DIRECTIVE_NAME_PRE + "value", {
      link: (scope, elememt, param) => {
        scope.$watch(param.parser, (newValue) => {
          elememt.value = newValue;
        });
      }
    })
    .directive(DIRECTIVE_NAME_PRE + "change", {
      link: (scope, elememt, param) => {
        var value = elememt.value;
        setTimeout(() => value = elememt.value);
        function onchange($event) {
          var $value = elememt.value;
          if (value == $value) return;
          value = $value;
          param.parser.exec(scope, { $event, $value });
          scope.applyAll();
        }
        elememt.addEventListener("keyup", onchange);
      }
    });

  /**
   * 快速模板及绑定
   * @param {HTMLElement} rootDom
   * @param {Object} param.template 模板
   * @param {Object} param.link 初始化scope
   */
  function parse(rootDom, param, childrenOnly) {
    if (!param) return;
    var vd = new CVirtureDom();
    vd.parseSelfFrom(rootDom);
    var scope = new Scope();
    CVirtureDom.cloneShow(rootDom, () => {
      vd.html(param.template || rootDom.innerHTML);
      param.link && param.link(scope);
      vd.compileUseScope(scope, childrenOnly || param.childrenOnly);
      vd.show(rootDom, scope, childrenOnly || param.childrenOnly);
      scope.applyAll();
    });
    return scope;
  }
  /** 导出功能 */
  extend(window[DJname] || (window[DJname] = {}), {
    isUndefined,
    isDefined,
    isObject,
    isString,
    isNumber,
    isDate,
    isArray,
    isFunction,
    isRegExp,
    merge,
    extend,
    equals,
    copyof,
    Scope,
    parse,
    directive: CVirtureDom.directive,
  });
})(window, "DJ", "dj-");
//})(window, "angular", "ng-");