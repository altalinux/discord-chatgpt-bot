const requiredMajor = 20;
const currentMajor = Number(process.versions.node.split(".")[0]);

if (currentMajor < requiredMajor) {
  console.error(
    "Node.js 20 or newer is required. Current version: " + process.versions.node,
  );
  console.error("Upgrade Node.js on the server, then run npm install again.");
  process.exit(1);
}
