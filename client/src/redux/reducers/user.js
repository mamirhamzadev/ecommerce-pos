const initialState = {
  user: null,
  token: "",
};

export const userReducer = (state = initialState, action) => {
  if (action.type === "USER") return action;
  return state;
};
