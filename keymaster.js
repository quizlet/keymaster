//     keymaster.js
//     (c) 2011-2013 Thomas Fuchs
//     keymaster.js may be freely distributed under the MIT license.
//     modified by Quizlet to add stacked-based scopes and a class-based filter override

(function(global) {
  var k,
    _handlers = {},
    _mods = { 16: false, 18: false, 17: false, 91: false },
    _scope = [],
    // modifier keys
    _MODIFIERS = {
      "⇧": 16,
      shift: 16,
      "⌥": 18,
      alt: 18,
      option: 18,
      "⌃": 17,
      ctrl: 17,
      control: 17,
      "⌘": 91,
      command: 91
    },
    // special keys
    _MAP = {
      backspace: 8,
      tab: 9,
      clear: 12,
      enter: 13,
      return: 13,
      esc: 27,
      escape: 27,
      space: 32,
      left: 37,
      up: 38,
      right: 39,
      down: 40,
      del: 46,
      delete: 46,
      home: 36,
      end: 35,
      pageup: 33,
      pagedown: 34,
      ",": 188,
      ".": 190,
      "/": 191,
      "`": 192,
      "-": 189,
      "=": 187,
      ";": 186,
      "'": 222,
      "[": 219,
      "]": 221,
      "\\": 220
    },
    _NUMPAD_TO_NORMAL = {
      // numeric pad numbers have different keycodes,
      // map them to their number counter part
      // 0 to 9
      96: 48, // 0
      97: 49, // 1
      98: 50, // 2
      99: 51, // 3
      100: 52, // 4
      101: 53, // 5
      102: 54, // 6
      103: 55, // 7
      104: 56, // 8
      105: 57 // 9
    };
  (code = function(x) {
    return _MAP[x] || x.toUpperCase().charCodeAt(0);
  }),
    (_downKeys = []);

  for (k = 1; k < 20; k++) _MAP["f" + k] = 111 + k;

  // IE doesn't support Array#indexOf, so have a simple replacement
  function index(array, item) {
    var i = array.length;
    while (i--) if (array[i] === item) return i;
    return -1;
  }

  // for comparing mods before unassignment
  function compareArray(a1, a2) {
    if (a1.length != a2.length) return false;
    for (var i = 0; i < a1.length; i++) {
      if (a1[i] !== a2[i]) return false;
    }
    return true;
  }

  var modifierMap = {
    16: "shiftKey",
    18: "altKey",
    17: "ctrlKey",
    91: "metaKey"
  };
  function updateModifierKey(event) {
    for (k in _mods) _mods[k] = event[modifierMap[k]];
  }

  // handle keydown event
  function dispatch(event) {
    var key, handler, k, i, modifiersMatch, scope;
    key = _NUMPAD_TO_NORMAL[event.keyCode] || event.keyCode;

    if (index(_downKeys, key) == -1) {
      _downKeys.push(key);
    }

    // if a modifier key, set the key.<modifierkeyname> property to true and return
    if (key == 93 || key == 224) key = 91; // right command on webkit, command on Gecko
    if (key in _mods) {
      _mods[key] = true;
      // 'assignKey' from inside this closure is exported to window.key
      for (k in _MODIFIERS) if (_MODIFIERS[k] == key) assignKey[k] = true;
      return;
    }
    updateModifierKey(event);

    // see if we need to ignore the keypress (filter() can can be overridden)
    // by default ignore key presses if a select, textarea, or input is focused
    if (!assignKey.filter.call(this, event)) return;

    // abort if no potentially matching shortcuts found
    if (!(key in _handlers)) return;

    scope = getScope();

    // for each potential shortcut
    for (i = 0; i < _handlers[key].length; i++) {
      handler = _handlers[key][i];

      // see if it's in the current scope
      if (
        (Array.isArray(scope) && scope.indexOf(handler.scope) >= 0) ||
        handler.scope == scope ||
        handler.scope == "all"
      ) {
        // check if modifiers match if any
        modifiersMatch = handler.mods.length > 0;
        for (k in _mods)
          if (
            (!_mods[k] && index(handler.mods, +k) > -1) ||
            (_mods[k] && index(handler.mods, +k) == -1)
          )
            modifiersMatch = false;
        // call the handler and stop the event if neccessary
        if (
          (handler.mods.length == 0 &&
            !_mods[16] &&
            !_mods[18] &&
            !_mods[17] &&
            !_mods[91]) ||
          modifiersMatch
        ) {
          if (handler.method(event, handler) === false) {
            if (event.preventDefault) event.preventDefault();
            else event.returnValue = false;
            if (event.stopPropagation) event.stopPropagation();
            if (event.cancelBubble) event.cancelBubble = true;
          }
        }
      }
    }
  }

  // unset modifier keys on keyup
  function clearModifier(event) {
    var key = event.keyCode,
      k,
      i = index(_downKeys, key);

    // remove key from _downKeys
    if (i >= 0) {
      _downKeys.splice(i, 1);
    }

    if (key == 93 || key == 224) key = 91;
    if (key in _mods) {
      _mods[key] = false;
      for (k in _MODIFIERS) if (_MODIFIERS[k] == key) assignKey[k] = false;
    }
  }

  function resetModifiers() {
    for (k in _mods) _mods[k] = false;
    for (k in _MODIFIERS) assignKey[k] = false;
  }

  // parse and assign shortcut
  function assignKey(key, scope, method) {
    var keys, mods;
    keys = getKeys(key);
    if (method === undefined) {
      method = scope;
      scope = "all";
    }

    // for each shortcut
    for (var i = 0; i < keys.length; i++) {
      // set modifier keys if any
      mods = [];
      key = keys[i].split("+");
      if (key.length > 1) {
        mods = getMods(key);
        key = [key[key.length - 1]];
      }
      // convert to keycode and...
      key = key[0];
      key = code(key);
      // ...store handler
      if (!(key in _handlers)) _handlers[key] = [];
      _handlers[key].push({
        shortcut: keys[i],
        scope: scope,
        method: method,
        key: keys[i],
        mods: mods
      });
    }
  }

  // unbind all handlers for given key in current scope
  function unbindKey(key, scope) {
    var multipleKeys,
      keys,
      mods = [],
      i,
      j,
      obj;

    multipleKeys = getKeys(key);

    for (j = 0; j < multipleKeys.length; j++) {
      keys = multipleKeys[j].split("+");

      if (keys.length > 1) {
        mods = getMods(keys);
      }

      key = keys[keys.length - 1];
      key = code(key);

      if (scope === undefined) {
        scope = getScope();
      }
      if (!_handlers[key]) {
        return;
      }
      for (i = 0; i < _handlers[key].length; i++) {
        obj = _handlers[key][i];
        // only clear handlers if correct scope and mods match
        if (obj.scope === scope && compareArray(obj.mods, mods)) {
          _handlers[key][i] = {};
        }
      }
    }
  }

  // Returns true if the key with code 'keyCode' is currently down
  // Converts strings into key codes.
  function isPressed(keyCode) {
    if (typeof keyCode == "string") {
      keyCode = code(keyCode);
    }
    return index(_downKeys, keyCode) != -1;
  }

  function getPressedKeyCodes() {
    return _downKeys.slice(0);
  }

  // different behavior from canonical repo to allow us to watch events on more
  // element types
  function filter(event) {
    var el = event.target || event.srcElement;
    // HTML document does not contain tagName and classList. Instead, we set
    // the element as document element.
    var el = el instanceof HTMLDocument ? el.documentElement : el;
    var tagName = el.tagName;
    var classList = el.classList;

    if (!(classList instanceof DOMTokenList)) {
      console.info("Event", event);
      throw new Error("Browser does not support classList");
    }

    var hasAllowedTag =
      tagName !== "INPUT" && tagName !== "SELECT" && tagName !== "TEXTAREA";
    var hasAllowedClass = classList.contains("js-keymaster-allow");

    return hasAllowedTag || hasAllowedClass;
  }

  // initialize key.<modifier> to false
  for (k in _MODIFIERS) assignKey[k] = false;

  // set current scope (default 'all')
  function setScope(scope) {
    if (scope) {
      _scope = [scope];
    } else {
      _scope = [];
    }
  }

  function getScope() {
    return _scope.length ? _scope[_scope.length - 1] : "all";
  }
  function pushScope(scope) {
    _scope.push(scope);
  }

  function popScope(scope) {
    newScope = [];
    for (var i = 0; i < _scope.length; i++) {
      if (_scope[i] !== scope) {
        newScope.push(_scope[i]);
      } else {
        break;
      }
    }
    _scope = newScope;

    // also remove scope from overlapping scope
    // if applicable
    removeOverlappingScope(scope);
  }

  // adds an overlapping scope on top of current scope
  function addOverlappingScope(scope) {
    var currScope = getScope();
    var newScope = [];

    if (currScope == "all") {
      // if current scope is "all", then call setScope instead
      setScope(scope);
      return;
    } else if (Array.isArray(currScope)) {
      // if there are already multiple scopes currently active,
      // preserve existing scopes when adding new scope
      newScope = currScope;
    } else {
      // if only one scope, preserve old scope
      newScope.push(currScope);
    }

    newScope.push(scope);
    _scope.push(newScope);
  }

  function removeOverlappingScope(scope) {
    var currScope = getScope();
    if (!Array.isArray(currScope)) {
      // if there aren't simultaneous scopes active, ignore
      return false;
    }

    var removeIndex = currScope.indexOf(scope);
    if (removeIndex >= 0) {
      // if overlapping scope exists, remove it from the list
      currScope.splice(removeIndex, 1);
    } else {
      return;
    }

    if (currScope.length == 0) {
      // if last overlapping scope is removed,
      // then remove the scope
      _scope.pop();
    } else {
      _scope[_scope.length - 1] = currScope;
    }
  }

  // delete all handlers for a given scope
  function deleteScope(scope) {
    var key, handlers, i;

    for (key in _handlers) {
      handlers = _handlers[key];
      for (i = 0; i < handlers.length; ) {
        if (handlers[i].scope === scope) handlers.splice(i, 1);
        else i++;
      }
    }
  }

  // abstract key logic for assign and unassign
  function getKeys(key) {
    var keys;
    key = key.replace(/\s/g, "");
    keys = key.split(",");
    if (keys[keys.length - 1] == "") {
      keys[keys.length - 2] += ",";
    }
    return keys;
  }

  // abstract mods logic for assign and unassign
  function getMods(key) {
    var mods = key.slice(0, key.length - 1);
    for (var mi = 0; mi < mods.length; mi++) mods[mi] = _MODIFIERS[mods[mi]];
    return mods;
  }

  // cross-browser events
  function addEvent(object, event, method) {
    if (object.addEventListener) object.addEventListener(event, method, false);
    else if (object.attachEvent)
      object.attachEvent("on" + event, function() {
        method(window.event);
      });
  }

  // set the handlers globally on document
  addEvent(document, "keydown", function(event) {
    dispatch(event);
  }); // Passing _scope to a callback to ensure it remains the same by execution. Fixes #48
  addEvent(document, "keyup", clearModifier);

  // reset modifiers to false whenever the window is (re)focused.
  addEvent(window, "focus", resetModifiers);

  // store previously defined key
  var previousKey = global.key;

  // restore previously defined key and return reference to our key object
  function noConflict() {
    var k = global.key;
    global.key = previousKey;
    return k;
  }

  // set window.key and window.key.set/get/deleteScope, and the default filter
  global.key = assignKey;
  global.key.setScope = setScope;
  global.key.getScope = getScope;
  global.key.pushScope = pushScope;
  global.key.popScope = popScope;
  global.key.addOverlappingScope = addOverlappingScope;
  global.key.removeOverlappingScope = removeOverlappingScope;
  global.key.deleteScope = deleteScope;
  global.key.filter = filter;
  global.key.isPressed = isPressed;
  global.key.getPressedKeyCodes = getPressedKeyCodes;
  global.key.noConflict = noConflict;
  global.key.unbind = unbindKey;

  if (typeof module !== "undefined") module.exports = assignKey;
})(this);
