export default {
  path: "/recursion-drop",
  redirect: "/recursion-drop/pure-recursion-drop",
  meta: {
    icon: "ri/information-line",
    // showLink: false,
    title: "递归包",
    rank: 8
  },
  children: [
    {
      path: "/recursion-drop/pure-recursion-drop",
      name: "pure-recursion-drop",
      component: () =>
        import("@/views/recursion-drop/new-pure-recursion/index.vue"),
      meta: {
        title: "纯递归包"
      }
    }
  ]
} satisfies RouteConfigsTable;
