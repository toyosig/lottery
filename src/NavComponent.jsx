import React from "react";

const NavComponent = () => {
  return (
    <nav style={styles.navbar}>
      {/* Logo */}
      <div style={styles.logo}>
        {/* <img 
          src="/logo.png"   // <-- replace with your logo
          alt="Logo"
          style={{ height: 45 }}
        /> */}

        <h2 style={styles.logo}>LOTTERY GAME</h2>
      </div>

      {/* Connect Button */}
      <button style={styles.connectBtn}>
        Connect
      </button>
    </nav>
  );
};

const styles = {
navbar: {
  width: "calc(100% - 40px)",   // 20px left + 20px right margin
  height: 70,
  background: "gold",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 25px",
  margin: "20px auto",          // TOP margin + centers it horizontally
  borderRadius: 12,             // optional: makes it look clean
  boxSizing: "border-box",
  boxShadow: "0 3px 12px rgba(0,0,0,0.2)",
},

  logo: {
    display: "flex",
    alignItems: "center",
    color: "#111",
  },
  connectBtn: {
    padding: "10px 25px",
    fontSize: "1.2rem",
    border: "none",
    borderRadius: 8,
    fontWeight: "bold",
    background: "#111",
    color: "gold",
    cursor: "pointer",
    transition: "0.3s",
  }
};

export default NavComponent;
