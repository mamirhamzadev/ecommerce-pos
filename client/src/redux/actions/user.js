export const setUser = (user, token) => {
  return {
    type: "USER",
    user: user,
    token: token,
  };
};

export const clearUser = () => {
  return {
    type: "USER",
    user: null,
    token: "",
  };
};
