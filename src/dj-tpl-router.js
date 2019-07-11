!(function (window, DJname, DIRECTIVE_NAME_PRE, undefined) {
  var DJ = window[DJname];
  if (!DJ || !DJ.directive) throw (`${DJname} base module not loaded`)

  function parseSearch(queryString) {
    var search = {};
    queryString && decodeURIComponent(queryString).replace(/([^?&=]+)=([^&]+)/g, (_, k, v) => search[k] = v);
    return search;
  }
  function makeHash(path, search) {
    search = search || {};
    var queryString = Object.keys(search).map(k => `${k}=${search[k]}`).join("&");
    return path + (queryString && "?" || "") + queryString;
  }
  function parseHash(hash) {
    var match = hash.match(/#\!?\/([^\?]+)(\?(.*))?$/);
    return !!match && { path: match[1] || "", search: parseSearch(match[3]) };
  }

  var RouteScope = new DJ.Scope();
  !(function (RouteScope, history) {
    var pushState = history.pushState;
    var replaceState = history.replaceState;
    history.pushState = function (state) {
      var r = pushState.apply(history, arguments);
      setHash(location.hash, false);
      return r;
    };
    history.replaceState = function (state) {
      var r = replaceState.apply(history, arguments);
      setHash(location.hash, false);
      return r;
    };
    window.addEventListener('popstate', () => setHash(location.hash, true), false);
    function setHash(hash, isNav) {
      if (RouteScope.newHash == hash) return false;
      RouteScope.oldHash = RouteScope.newHash || "";
      RouteScope.newHash = hash;
      RouteScope.isNav = isNav;
      RouteScope.apply();
    }
    setTimeout(() => { setHash(location.hash, false); })
  })(RouteScope, window.history);

  var CRouter = (function () {

    var theRouterList = [];

    function CRouterItem(path, param) {
      this.path = path;
      this.param = param || {};
    }

    function CRouter() { }

    CRouter.router = function (path, param) {
      if (arguments.length == 1) return theRouterList.find(r => path && (r.path == path || r.path == path.path)) || theRouterList.otherwise;
      theRouterList.push(new CRouterItem(path, param));
      return CRouter;
    }
    CRouter.router.state = () => RouteScope.state;
    CRouter.otherwise = param => theRouterList.otherwise = { param }

    RouteScope.$watch("newHash", hash => {
      var state = parseHash(hash);
      var router = CRouter.router(state.path);
      if (!router) {
        RouteScope.router = false;
        RouteScope.state = false;
        return;
      }
      RouteScope.router = router;
      RouteScope.state = state || {};
    });

    return CRouter;
  })();

  DJ.directive(DIRECTIVE_NAME_PRE + "view", {
    link: function (scope, elememt, param) {
      RouteScope.$watch("state", state => {
        if (state===false) {
          console.error("router not found", state);
          return;
        }
        DJ.parse(elememt, RouteScope.router.param, true);
      });
    }
  });

  /** 导出功能 */
  DJ.extend(DJ, {
    CRouter,
    router: CRouter.router,
  });
})(window, "DJ", "dj-");
//})(window, "angular", "ng-");