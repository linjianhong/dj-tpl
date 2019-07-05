!(function (window, DJname, DIRECTIVE_NAME_PRE, undefined) {
  var REG_BIND = /\{\{.+\}\}/;
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
          } else if (src.nodeName) {
            dst[key] = src.cloneNode(true);
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
    var t1 = typeof o1, t2 = typeof o2, length, key;
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
          keySet[key] = true;
        }
        for (key in o2) {
          if (!(key in keySet) &&
            isDefined(o2[key]) &&
            !isFunction(o2[key])) return false;
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
  var $ = (function () {
    function $(selectors, parent) {
      return (parent || document).querySelector(selectors);
    }
    $.create = function (tagName, options) {
      return document.createElement(tagName, options);
    }
    HTMLElement.prototype.css = function (k, v) {
      if (arguments.length > 1) {
        this.style[k] = v;
        return this;
      }
      else if (isObject(k)) {
        for (var name in k) {
          this.style[name] = k[name];
        }
        return this;
      }
      else if (isString(k)) {
        return this.style[k];
      }
    }
    return $;
  })();

  /**
   * 解析器
   */
  var CParser = (function (undefined) {
    var MIN_OP = { level: 0 };
    var REG_METAS = /(?:(?<!\$)\b(?!(?:(?:\.?\d)|\$)))|(?:(?<!\.)\b(?=\d))|(?:(?<!\w)(?=\$))|(?:(?<=\$)(?!\w))|(?:(?<=[\+\-\*\/\[\]\(\)]))|(?:(?=[\[\]\(\)\+\-\!]))/;

    class CParser {
      constructor(str) {
        this.str = str.trim();
        this.valueList = this.str && CParser.parse(this.str) || [];
      }

      run(scope, params) {
        var R, parser = new _Parser(scope, params);
        this.valueList.map(valueItem => {
          R = parser.run(valueItem, scope, params)
        });
        return R;
      }

      getValue(scope, params) {
        var R, parser = new _Parser(scope, params);
        this.valueList.map(valueItem => {
          R = parser.getValue(valueItem, scope, params)
        });
        return R;
      }

      static parse(template) {
        var metas = parseMore(parseStringMetas(template));
        var valueList = getValueList(metas, 0, ";");
        return valueList && valueList.pos >= metas.length && valueList.valueList || [];
      }

      static parseTextBind(text) {
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
    }

    class _Parser {
      constructor(scope, params) {
        this.scope = scope;
        this.params = params || {};
      }

      run(valueItem) {
        return this.getValue(valueItem);
      }

      getMemberName(valueItem) {
        if (valueItem.type == "var") {
          return valueItem.value;
        }
        return this.getValue(valueItem);
      }

      getValue(valueItem) {
        if (!(valueItem instanceof Meta)) return "";
        if (valueItem.isStatic()) return valueItem.value;
        if (valueItem.type == "var") {
          if (this.params.hasOwnProperty(valueItem.value)) return this.params[valueItem.value];
          return this.scope.$member(valueItem.value);
        }
        /** 求反 */
        if (valueItem.type == "!") {
          return !this.getValue(valueItem.value);
        }
        if (valueItem.type == "-") {
          return -this.getValue(valueItem.value);
        }
        if (valueItem.type == "+") {
          return +this.getValue(valueItem.value);
        }
        /** 成员属性 */
        if (valueItem.type == "member") {
          var v1 = this.getValue(valueItem.value.v1);
          if (!v1) return "";
          var v2 = this.getValue(valueItem.value.v2);
          return v1[v2];
        }
        /** 函数 */
        if (valueItem.type == "call") {
          var value = valueItem.value || {};
          var caller = value.caller;
          if (!(caller instanceof Meta)) return "";
          var valueList = this.getValueList(value.valueList);
          if (caller.type == "var") {
            return this.scope.$memberCall(caller.value, valueList);
          } else if (caller.type == "member") {
            var v1 = this.getValue(caller.v1);
            var v2 = this.getValue(caller.v2);
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
            return this.getValue(meta);
          });
          return CCalcu.calc(valueAndOperators);
        }
        return "";
      }

      getValueList(valueList) {
        if (!isArray(valueList)) return [];
        return valueList.map(valueItem => this.getValue(valueItem));
      }
    }

    class Meta {
      constructor(type, value) {
        this.type = type;
        this.value = value;
      }

      isStatic() {
        return this.type == "number" || this.type == "string";
      }

      isOperator(value) {
        return this.type == "operator" && this.value == value;
      }
    }


    /**
     * 解析器运算类
     */
    class CCalcu {
      constructor(valueAndOperators) {
        this.valueAndOperators = valueAndOperators;
      }
      static findOperator(str) {
        return this.operators.find(item => item.value == str);
      }

      static isCalcOperator(str) {
        return !!(this.operators.find(item => item.value == str) || {}).level;
      }

      static calc(valueAndOperators) {
        return new CCalcu(valueAndOperators).calc();
      }

      calc() {
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
      }

      /**
       * 计算之前入栈的数据
       * 保持每个栈的 pre 的运算符优先级小于后面入栈的运算符
       * @思路 每次入栈，循环： @操作 { 如果新的优先级不超过前一栈，那就要把前一栈计算掉 }
       * @计算 总是发生在 this.stack.pre 节点上
       *   这样处理后，最后入栈的运算符优先级，一定是整个栈中最高的
       */
      calcPre() {
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
      { value: "+", level: 80, calc: (a, b) => a + b },
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
    function parseStringMetas(template) {
      template = template.trim();
      if (!template) return [];
      var metas = [], list, s;
      // 提取字符串
      list = template.split("'");
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
          metas.push(new Meta("string", list[i]));
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
  class Scope {
    constructor(parentScope) {
      this.$id = Scope.id = (Scope.id || 0) + 1;
      this.$parent = parentScope;
      this.$watcher = [];
      this.$childScope = [];
      parentScope && parentScope.$childScope.push(this);
    }

    $destroy() {
      this.$watcher = [];
      this.$childScope.map(scope => scope.$destroy());
      this.$childScope = [];
      this.$parent && (this.$parent.$childScope = this.$parent.$childScope.filter(c => c != this));
      this.$parent = null;
    }

    $member(name) {
      if (this.hasOwnProperty(name)) return this[name];
      if (this.$parent) return this.$parent.$member(name);
      return "";
    }

    $memberCall(name, params) {
      if (isFunction(this[name])) return this[name].apply(this, params);
      if (this.$parent) return this.$parent.$memberCall(name, params);
      return "";
    }

    applyAll(onlyChild) {
      if (!onlyChild && this.$parent) return this.$parent.applyAll(onlyChild);
      this.apply();
      this.$childScope.map(scope => scope.applyAll(2));
    }

    apply() {
      //console.log("apply, scope_id=", this.$id, ", timerid=", id);
      if (this.$timerid) return;
      this.$timerid = setTimeout(() => {
        //console.log("apply(运行), scope_id=", this.$id, ", timerid=", id);
        this.$watcher.map(watcher => {
          var newValue = watcher.parser.getValue(this, {});
          if (equals(newValue, watcher.lastValue)) return;
          //console.log("apply (watcher), str=", watcher.parser.str, "newValue=", newValue, "lastValue=", watcher.lastValue, ", scope_id=", this.$id, ", timerid=", id);
          watcher.callback(newValue, watcher.lastValue);
          watcher.lastValue = copyof(newValue);
        });
        this.$timerid = 0;
        //console.log("apply(运行 end.), scope_id=", this.$id, ", timerid=", id);
      })
    }

    $watch(parser, callback) {
      var watcher = { parser, callback };
      this.$watcher.push(watcher);
      return watcher;
    }
  };

  /**
   * 虚拟Dom类
   * @member {CVirtureDom} parent  父节点
   * @member {[CVirtureDom]} children  所有后代节点
   * @member {string} nodeName 节点类型，同DOM元素
   * @member {Object} nodeValue nodeName=="#text"时有效，可能含有文本绑定配置
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
   * 
   */
  class CVirtureDom {
    constructor(parent) {
      this.$id = CVirtureDom.id = (CVirtureDom.id || 0) + 1;
      this.parent = parent;
      parent && parent.children.push(this);
      this.children = [];
      this.vElements = { list: [] };
      this._vElements = { list: [] };
    }

    html(template) {
      var dom = document.createElement("div");
      dom.innerHTML = (template || "").trim();
      this.parseChildrenFrom(dom);
    }

    /**
     * 建立本元素的虚拟DOM三大数据
     * @param {HTMLElement} dom 
     */
    parseSelfFrom(dom) {
      this.nodeName = dom.nodeName;
      this.nodeValue = { value: dom.nodeValue };
      this.attributes = [].map.call(dom.attributes || [], attr => ({ name: attr.name, value: attr.value }));
    }

    /**
     * 建立后代元素的虚拟DOM
     * @param {HTMLElement} dom 
     */
    parseChildrenFrom(dom) {
      this.children = [];
      if (!dom.hasChildNodes()) return;
      var nodes = dom.childNodes;
      [].map.call(nodes || [], node => {
        if (node.nodeName == "#text" && !node.nodeValue.trim()) return;
        var vd = new CVirtureDom(this);
        vd.parseAllFrom(node);
      });
    }

    /**
     * 建立完整的虚拟DOM
     * @param {HTMLElement} dom 
     */
    parseAllFrom(dom) {
      this.parseSelfFrom(dom);
      this.parseChildrenFrom(dom);
    }

    copyFrom(old) {
      this.nodeName = old.nodeName;
      this.nodeValue = merge({}, old.nodeValue);
      this.attributes = merge([], old.attributes);
      this.children = [];
      old.children.map(vd => {
        var vdSub = new CVirtureDom(this);
        vdSub.copyFrom(vd);
      });
    }

    static compileTextBind(obj) {
      if (!obj.value || !REG_BIND.test(obj.value)) return;
      var parser = CParser.parseTextBind(obj.value);
      obj.compile = {
        type: "TextBind",
        parser,
      };
    }
    static showTextBind(obj, scope, callback) {
      if (!obj.compile || obj.compile.type != "TextBind") return;
      var parser = obj.compile.parser;
      scope.$watch(parser, callback);
      callback(obj.value);
    }

    /**
     * 使用上下文进行编译
     * @param {Scope} scope 
     * 编译后，生成 vElement 数据，可一一对应生成实际的 dom
     * 各 vElement 数据中的指令，在显示(show)时，调用link, 以兑现指令功能
     */
    compileUseScope(scope) {
      if (this.compileFor(scope) !== false) return;
      if (this.compileIf(scope) !== false) return;
      //this.vElements = [{ vd: this }];
      var templated = false;
      this.attributes.map(attr => {
        attr.compile = null;
        var directive = this.compileDirective(scope, attr, templated);
        if (directive) {
          templated = templated || directive.templated;
        } else {
          CVirtureDom.compileTextBind(attr);
        }
      });
      CVirtureDom.compileTextBind(this.nodeValue);
      this.children.map(vdSub => vdSub.compileUseScope(scope));
    }

    compileDirective(parentScope, attr, templateonly = false) {
      var templated = false;
      var directive = CVirtureDom.directiveList.find(directive => directive.name == attr.name);
      if (!directive) return false;
      directive = directive.directive;
      if (isFunction(directive)) directive = directive(directive);
      if (directive.hasOwnProperty('template')) {
        if (templateonly) throw ("mulity template directive.");
        templated = true;
        this.html(directive.template)
      }
      var parser = directive.parser && directive.parser(attr.value) || new CParser(attr.value);
      attr.compile = {
        type: "Directive",
        directive,
        parser,
      };
      return { templated };
    }

    compileFor(parentScope) {
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
        this.backupElements();
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
          this.appendElements({ vd, scope });
        }
        // 更新 虚拟Dom信息
        this.updateElements(parentScope);
      });
    }

    compileIf(parentScope) {
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
        this.backupElements();
        // 重新生成 虚拟Dom信息
        if (newValue) {
          var scope = new Scope(parentScope);
          var vd = new CVirtureDom(this.parent);
          vd.copyFrom(this);
          vd.attributes = vd.attributes.filter(attr => attr.name != DIRECTIVE_NAME_IF);
          vd.compileUseScope(scope);
          this.appendElements({ vd, scope });
        }
        // 更新 虚拟Dom信息
        this.updateElements(parentScope);
      });
    }

    destoryElements(where) {
      if (!this.vElements.comment) return;
      var begin = this.vElements.comment.begin;
      var end = this.vElements.comment.end;
      if (!begin || !end) return;
      while (begin.nextSibling && begin.nextSibling != end) {
        begin.nextSibling.remove();
      }
      (where || []).map(name => {
        ((this[name] || {}).list || []).map(vElement => {
          var vd = vElement.vd;
          vElement.scope && vElement.scope.$destroy();
          vElement.scope = null;
          vElement.elememt = null;
          vd.destoryElements(["vElements", "_vElements"]);
        });
      });
    }
    backupElements() {
      this._vElements.list = this.vElements.list;
      this.vElements.list = [];
    }
    appendElements(datas) {
      this.vElements.list.push(datas);
    }
    updateElements(parentScope) {
      if (!this.vElements.comment || !this.vElements.comment.begin) return;
      CVirtureDom.cloneShow(this.vElements.comment.begin.parentNode, () => {
        // 删除位置前后内容
        this.destoryElements(["_vElements"]);
        // 新加内容
        this.vElements.list.map(vElement => {
          var vd = vElement.vd;
          var elememts = vd.createElements();
          elememts.map(elememt => this.vElements.comment.end.before(elememt));
          if (vd.vElements.comment && vd.vElements.comment.text) {
          }
          else if (vd.nodeName == "#text") {
            CVirtureDom.showTextBind(vd.nodeValue, vElement.scope, newValue => {
              elememts[0].nodeValue = newValue;
            });
          }
          else {
            vd.show(elememts[0], vElement.scope);
          }
        });
        parentScope.applyAll(1);
      });
    }

    /**
     * 
     * @param {HTMLElement} rootDom 
     * @param {Scope} scope 
     */
    createElements() {
      var vElements = this.vElements;
      var comment = vElements.comment;
      if (comment && comment.text) {
        comment.begin = comment.begin || document.createComment(comment.text + " begin");
        comment.end = comment.end || document.createComment(comment.text + " end");
        return [comment.begin, comment.end]
      } else if (this.nodeName == "#text") {
        vElements.elememt = vElements.elememt || document.createTextNode(this.nodeValue.value || "");
        return [vElements.elememt];
      } else {
        vElements.elememt = vElements.elememt || document.createElement(this.nodeName);
        return [vElements.elememt];
      }
    }

    /**
     * 
     * @param {HTMLElement} rootDom 
     * @param {Scope} scope 
     */
    show(rootDom, scope) {
      rootDom.innerHTML = "";
      this.attributes.map(attr => {
        if (!attr.compile) {
          rootDom.setAttribute(attr.name, attr.value);
        }
        else if (attr.compile.type == "Directive") {
          // elememt.setAttribute(attr.name, attr.value);
          var link = attr.compile.directive.link;
          var children = link && link(scope, rootDom, attr.compile.parser, attr.compile.directive);
          (children || []).map(child => {
            parentNode.append(child.elememt);
            //vd.show(child.elememt, child.scope);
          });
        } else if (attr.compile.type == "TextBind") {
          CVirtureDom.showTextBind(attr, scope, newValue => {
            rootDom.setAttribute(attr.name, newValue);
          });
        } else {
          rootDom.setAttribute(attr.name, attr.value);
        }
      });

      this.children.map(child => {
        var elememts = child.createElements();
        elememts.map(elememt => rootDom.append(elememt));
        if (child.vElements.comment && child.vElements.comment.text) {
        }
        else if (child.nodeName == "#text") {
          CVirtureDom.showTextBind(child.nodeValue, scope, newValue => {
            elememts[0].nodeValue = newValue;
          });
        }
        else {
          child.show(elememts[0], scope);
        }
      });
    }

    /**
     * 快速模板及绑定
     * @param {HTMLElement} rootNode 
     * @param {Object} param.template 模板 
     * @param {Object} param.link 初始化scope 
     */
    static parse(rootDom, param) {
      if (!param) return;
      var vd = new CVirtureDom();
      vd.parseSelfFrom(rootDom);
      var scope = new Scope();
      CVirtureDom.cloneShow(rootDom, () => {
        vd.html(param.template || rootDom.innerHTML);
        param.link && param.link(scope);
        vd.compileUseScope(scope);
        vd.show(rootDom, scope);
        scope.applyAll();
      });
      return scope;
    }

    static cloneShow(dom, callback) {
      if(dom.cloneShowing)return callback();
      console.log("cloneShow", dom);
      dom.cloneShowing = true;
      var elementNode = dom;
      var parentNode = elementNode.parentNode;
      var cloneNode = elementNode.cloneNode(true);
      parentNode.replaceChild(cloneNode, elementNode);
      callback();
      setTimeout(() => {
        parentNode.replaceChild(elementNode, cloneNode);
        dom.cloneShowing = false;
      });
    }

    static directive(name, directive) {
      CVirtureDom.directiveList = CVirtureDom.directiveList || [];
      CVirtureDom.directiveList.push({ name, directive });
      return CVirtureDom;
    }
  }

  CVirtureDom
    .directive(DIRECTIVE_NAME_PRE + "click", {
      link: (scope, elememt, parser, directive) => {
        elememt.addEventListener("click", $event => {
          parser.run(scope, { $event });
          scope.applyAll();
        });
      }
    })
    .directive(DIRECTIVE_NAME_PRE + "value", {
      link: (scope, elememt, parser, directive) => {
        scope.$watch(parser, (newValue) => {
          elememt.value = newValue;
        });
      }
    })
    .directive(DIRECTIVE_NAME_PRE + "change", {
      link: (scope, elememt, parser, directive) => {
        var value = elememt.value;
        setTimeout(() => value = elememt.value);
        function onchange($event) {
          var $value = elememt.value;
          if (value == $value) return;
          console.log("值改变", { value, $value });
          value = $value;
          parser.run(scope, { $event, $value });
          scope.applyAll();
        }
        elememt.addEventListener("keyup", onchange);
      }
    });

  /** 导出功能 */
  extend(window[DJname] || (window[DJname] = {}), {
    $,
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
    // Scope,
    // CParser,
    // CVirtureDom,
    parse: CVirtureDom.parse,
  });
})(window, "DJ", "dj-");