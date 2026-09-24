/**
 * Multi-Tenant Scoping Middleware
 * Enforces strict tenant data boundaries:
 * - Super Admin: Global overview, can filter any organization with ?organizationId=...
 * - Admin: Hard-scoped to req.user.organizationId
 * - Vendor: Hard-scoped to req.user.organizationId
 */
const tenantMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  const role = (req.user.role || "").toLowerCase();

  // Super Admin has global access
  if (role === "superadmin") {
    req.tenantFilter = req.query.organizationId ? { organizationId: req.query.organizationId } : {};
    return next();
  }

  // Org Admin and Vendor are strictly locked to their organization
  if (role === "admin" || role === "vendor") {
    if (!req.user.organizationId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Account is not assigned to an organization.",
      });
    }

    req.tenantFilter = { organizationId: req.user.organizationId };

    // For POST/PUT payloads, guarantee organizationId is enforced to the caller's tenant
    if (req.body && typeof req.body === "object") {
      req.body.organizationId = req.user.organizationId.toString();
    }

    return next();
  }

  return res.status(403).json({ success: false, message: "Forbidden: Unauthorized tenant access." });
};

module.exports = tenantMiddleware;
