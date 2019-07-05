# dj-tpl
超轻量级HTML模板引擎 - 针对前端应用的增强HTML！

## 一、概述
* 类似 angularJs 功能，超轻量级，**含注释，源码仅900多行；**
* 模板编译
* 上下文数据和事件绑定
* 复杂的表达式解析功能
* 自定义指令
* 简单易用，[查看 Demo](https://linjianhong.github.io/dj-tpl/docs/index.html)

## 二、 提供5个基本指令，以及快速数据绑定 ：
1. `dj-click`,  类似 angularJs 的 `ng-click` 指令
1. `dj-for`,   类似 angularJs 的 `ng-repeat` 指令
1. `dj-if`, 类似 angularJs 的 `ng-if` 指令
1. `dj-value`,  类似 angularJs 的 `ng-modal` 指令, 但仅单向绑定
1. `dj-change`, 类似 angularJs 的 `ng-change` 指令
1. 快速绑定功能，类似 angularJs 的 `{{...}}` 绑定功能；

## 三、识别基本所有的 JS 操作符：
1. 算术运算符 `+-*/%`
1. 比较运算符 `== != > < >= <=`
1. 单目运算符 `!+-`
1. 逻辑运算符 `&& || ^^`
1. 成员操作符 `. []`
1. 函数调用 `()`
1. 优先操作符 `()`
1. 函数参数分隔符 `,`
1. 多语句分隔符 `;`

## 四、虚拟DOM处理
1. 虚拟DOM，处理数据更快
1. 操作DOM时集中到离线DOM上，高效刷新DOM显示

## 五、使用简单
```
var dom = document.querySelector("#test");
DJ.parse(dom, {
  template: `
    <button dj-click="append()">append</button>
    <div dj-for="k in D.list">k={{k}}, text = {{D.list[k].text}}</div>
    <div dj-for="item of D.obj">{{$key}}: {{item}}</div>
    <input dj-value="username" dj-change="onUserName($value,$event)">
    <div>username={{username}}</div>
  `,
  link: function (scope) {
    scope.username = "Harry Potter";
    scope.D = {
      obj: {
        type: "like",
        text: "AngularJS",
      },
      list: [
        { text: "like AngularJS" },
        { text: "prefix is `dj-`" },
      ],
    }
    scope.append = function () {
      scope.D.list.push({ text: "item-" + (scope.D.list.length + 1) });
    }
    scope.onUserName = function (value, event) {
      scope.username = value;
    }
  }
});
```

[查看 Demo](https://linjianhong.github.io/dj-tpl/docs/index.html)

