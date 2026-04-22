// Quick syntax check - import and exit
console.log("✅ Checking server.js syntax...");
try {
  import('./server.js').catch(err => {
    console.error("❌ Syntax error:", err.message);
    process.exit(1);
  });
  console.log("✅ No syntax errors found");
  setTimeout(() => process.exit(0), 2000);
} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
}
