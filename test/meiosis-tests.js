import { expect } from "chai";
import { merge } from "ramda";
import h from "snabbdom/h";
import Task from "data.task";

import { meiosis } from "../src/index";

const {div, span} = require("hyperscript-helpers")(h);

describe("meiosis", function() {

  let vnode = null;

  // adapters
  let wires = {};
  const createWire = () => {
    let receiver = null;
    const receive = rcv => receiver = rcv;
    const send = data => receiver(data);

    return { send, receive };
  };
  const wire = name => {
    let theWire = wires[name];
    if (!theWire) {
      theWire = createWire();
      wires[name] = theWire;
    }
    return theWire;
  };
  const render = view => { vnode = view; };
  const adapters = { render, wire };

  // prepare Meiosis
  const Meiosis = meiosis(adapters);
  const createFeature = Meiosis.createFeature;

  // baseline config for tests
  const baseConfig = {
    name: "test",
    initialModel: {},
    model: (model, _next) => model,
    actions: _next => ({}),
    view: _props => null,
    chain: (_model, _next) => null
  };

  it("calls the view with actions and model", function(done) {
    const initial = { duck: "quack" };

    Meiosis.run(createFeature(merge(baseConfig, {
      initialModel: initial,

      view: props => {
        expect(props.actions).to.exist;
        expect(props.model).to.exist;
        expect(props.model).to.deep.equal(initial);

        done();
      }
    })));
  });

  it("renders a view", function() {
    const initial = { duck: "quack" };

    const view = props => span(`A duck says ${props.model.duck}`);

    Meiosis.run(createFeature(merge(baseConfig, {
      initialModel: initial,
      view: view
    })));

    expect(vnode).to.exist;
    expect(vnode.sel).to.equal("span");
    expect(vnode.text).to.equal("A duck says quack");
  });

  it("renders a tree of views", function() {
    const FormText = "Form";
    const ListText = "List";

    const Form = createFeature(merge(baseConfig, { name: "Form", view: _props => div(FormText) }));
    const List = createFeature(merge(baseConfig, { name: "List", view: _props => div(ListText) }));
    const Main = createFeature(merge(baseConfig, { name: "Main", view: props => div([Form(props), List(props)]) }));

    Meiosis.run(Main);

    expect(vnode).to.exist;
    expect(vnode.sel).to.equal("div");
    expect(vnode.children.length).to.equal(2);

    expect(vnode.children[0].text).to.equal(FormText);
    expect(vnode.children[1].text).to.equal(ListText);
  });

  it("triggers an action", function() {
    const UPDATE = "update";

    const actions = next => ({
      update: () => next(UPDATE)
    });

    let actionsRef = null;

    const Main = createFeature(merge(baseConfig, {
      name: "action",
      initialModel: { name: "one"},
      actions: actions,
      view: props => {
        actionsRef = props.actions;
        return span(props.model.name);
      },
      model: (model, action) => {
        if (action === UPDATE) {
          return { name: "two" };
        }
        return model;
      }
    }));
    
    Meiosis.run(Main);
    expect(vnode.text).to.equal("one");

    actionsRef.update();
    expect(vnode.text).to.equal("two");
  });

  it("chains an action", function() {
    const UPDATE = "update";
    const REFRESH = "refresh";

    const actions = next => ({
      update: () => next(UPDATE),
      refresh: () => next(REFRESH)
    });

    let actionsRef = null;

    const Main = createFeature(merge(baseConfig, {
      name: "chain",
      initialModel: { name: "one"},
      actions: actions,
      view: props => {
        actionsRef = props.actions;
        return span(props.model.name);
      },
      model: (model, action) => {
        if (action === UPDATE) {
          return { name: "two" };
        }
        else if (action === REFRESH) {
          return { name: "four" };
        }
        return model;
      },
      chain: (model, action, actions) => {
        if (action === UPDATE) {
          actions.refresh();
        }
      }
    }));
    
    Meiosis.run(Main);
    expect(vnode.text).to.equal("one");

    actionsRef.update();
    expect(vnode.text).to.equal("four");
  });

  it("merges the models into a single root model", function() {
    const UPDATE = "update";

    const actions = next => ({
      update: () => next(UPDATE)
    });

    let actionsRef = null;

    const Form = createFeature(merge(baseConfig, {
      name: "Form",
      initialModel: { formText: "F1" },
      view: props => span(props.model.formText)
    }));

    const List = createFeature(merge(baseConfig, {
      name: "List",
      initialModel: { listText: "L1" },
      view: props => span(props.model.listText)
    }));

    const Main = createFeature(merge(baseConfig, {
      name: "Main",
      initialModel: { name: "one"},
      actions: actions,
      view: props => {
        actionsRef = props.actions;
        return div(
          [ span(props.model.name)
          , Form(props)
          , List(props)
          ]
        );
      },
      model: (model, action) => {
        if (action === UPDATE) {
          return { name: "two", formText: "F2", listText: "L2" };
        }
        return model;
      }
    }));
    
    Meiosis.run(Main);

    expect(vnode.children.length).to.equal(3);
    expect(vnode.children[0].text).to.equal("one");
    expect(vnode.children[1].text).to.equal("F1");
    expect(vnode.children[2].text).to.equal("L1");

    actionsRef.update();
    expect(vnode.children[0].text).to.equal("two");
    expect(vnode.children[1].text).to.equal("F2");
    expect(vnode.children[2].text).to.equal("L2");
  });

  it("reflects change from one view in another view", function() {
    const UPDATE = "update";

    const actions = next => ({
      update: () => next(UPDATE)
    });

    let actionsRef = null;

    const Form = createFeature(merge(baseConfig, {
      name: "Form",
      initialModel: { formText: "F1" },
      view: props => span(props.model.formText)
    }));

    const List = createFeature(merge(baseConfig, {
      name: "List",
      initialModel: { listText: "L1" },
      actions: actions,
      view: props => {
        actionsRef = props.actions;
        return span(props.model.listText);
      },
      model: (model, action) => {
        if (action === UPDATE) {
          return { formText: "F2" };
        }
        return model;
      }
    }));

    const Main = createFeature(merge(baseConfig, {
      name: "Main",
      initialModel: { name: "one"},
      actions: actions,
      view: props => div(
        [ span(props.model.name)
        , Form(props)
        , List(props)
        ]
      )
    }));
    
    Meiosis.run(Main);

    expect(vnode.children.length).to.equal(3);
    expect(vnode.children[0].text).to.equal("one");
    expect(vnode.children[1].text).to.equal("F1");
    expect(vnode.children[2].text).to.equal("L1");

    actionsRef.update();
    expect(vnode.children[0].text).to.equal("one");
    expect(vnode.children[1].text).to.equal("F2");
    expect(vnode.children[2].text).to.equal("L1");
  });

  it("executes tasks", function(done) {
    const INCREMENT = "increment";

    let value = 0;
    let actionsRef = null;

    const task = new Task((rej, res) => { res(42); });

    const actions = next => ({
      increment: () => task.fork(null, res => { value = res; next(INCREMENT); })
    });

    Meiosis.run(createFeature(merge(baseConfig, {
      name: "task",
      initialModel: { counter: 1 },
      actions: actions,
      view: props => {
        actionsRef = props.actions;
        return span("test");
      },
      model: (model, action) => {
        if (action === INCREMENT) {
          expect(value).to.equal(42);
          done();
        }
        return model;
      }
    })));

    actionsRef.increment();
  });
});