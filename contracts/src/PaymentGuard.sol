// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title PaymentGuard — On-chain safety module for autonomous agent payments
/// @notice Enforces spending limits, skill allowlists, and emergency controls
///         so AI agents can operate autonomously within safe boundaries.
///
/// Design philosophy: An agent should be able to pay for skills WITHOUT human
/// approval on every transaction — but WITH on-chain guardrails that bound
/// its economic exposure. This is the "Safety Kernel" for agent commerce.
///
/// Three layers of protection:
///   1. SpendingCap — max USDC per agent per epoch (rolling window)
///   2. SkillAllowlist — agent owners whitelist which skills their agent can call
///   3. EmergencyBrake — governor can freeze all agent activity instantly
contract PaymentGuard {
    // -----------------------------------------------------------------
    //  Types
    // -----------------------------------------------------------------

    struct AgentPolicy {
        address owner;           // who controls this agent's policy
        uint256 epochDuration;   // seconds per spending window (e.g. 3600 = 1 hour)
        uint256 maxSpendPerEpoch; // max USDC (6 decimals) per epoch
        uint256 currentEpochStart;
        uint256 currentEpochSpend;
        bool active;
    }

    // -----------------------------------------------------------------
    //  Storage
    // -----------------------------------------------------------------

    address public immutable governor;
    bool public paused; // emergency brake

    /// @dev agent address => policy
    mapping(address => AgentPolicy) private _policies;

    /// @dev agent address => skillId => allowed
    mapping(address => mapping(uint256 => bool)) private _allowedSkills;

    /// @dev agent address => number of allowed skills (0 = all skills allowed)
    mapping(address => uint256) private _allowlistCount;

    // -----------------------------------------------------------------
    //  Events
    // -----------------------------------------------------------------

    event PolicyCreated(address indexed agent, address indexed owner, uint256 maxSpend, uint256 epochDuration);
    event PolicyUpdated(address indexed agent, uint256 newMaxSpend, uint256 newEpochDuration);
    event SpendRecorded(address indexed agent, uint256 skillId, uint256 amount, uint256 epochSpend, uint256 remaining);
    event SkillAllowed(address indexed agent, uint256 indexed skillId);
    event SkillRevoked(address indexed agent, uint256 indexed skillId);
    event EmergencyPause(address indexed triggeredBy);
    event EmergencyUnpause(address indexed triggeredBy);

    // -----------------------------------------------------------------
    //  Errors
    // -----------------------------------------------------------------

    error NotPolicyOwner();
    error PolicyNotFound();
    error SpendingCapExceeded(uint256 requested, uint256 remaining);
    error SkillNotAllowed(uint256 skillId);
    error Paused();
    error NotGovernor();
    error PolicyAlreadyExists();

    // -----------------------------------------------------------------
    //  Constructor
    // -----------------------------------------------------------------

    constructor(address _governor) {
        governor = _governor;
    }

    // -----------------------------------------------------------------
    //  Modifiers
    // -----------------------------------------------------------------

    modifier onlyPolicyOwner(address agent) {
        if (_policies[agent].owner != msg.sender) revert NotPolicyOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    // -----------------------------------------------------------------
    //  Policy Management
    // -----------------------------------------------------------------

    /// @notice Create a spending policy for an agent.
    /// @param agent The agent wallet address
    /// @param maxSpendPerEpoch Maximum USDC spend per epoch (6 decimals)
    /// @param epochDuration Duration of each spending window in seconds
    function createPolicy(
        address agent,
        uint256 maxSpendPerEpoch,
        uint256 epochDuration
    ) external {
        if (_policies[agent].active) revert PolicyAlreadyExists();

        _policies[agent] = AgentPolicy({
            owner: msg.sender,
            epochDuration: epochDuration,
            maxSpendPerEpoch: maxSpendPerEpoch,
            currentEpochStart: block.timestamp,
            currentEpochSpend: 0,
            active: true
        });

        emit PolicyCreated(agent, msg.sender, maxSpendPerEpoch, epochDuration);
    }

    /// @notice Update spending limits for an agent.
    function updatePolicy(
        address agent,
        uint256 newMaxSpend,
        uint256 newEpochDuration
    ) external onlyPolicyOwner(agent) {
        _policies[agent].maxSpendPerEpoch = newMaxSpend;
        _policies[agent].epochDuration = newEpochDuration;
        emit PolicyUpdated(agent, newMaxSpend, newEpochDuration);
    }

    // -----------------------------------------------------------------
    //  Skill Allowlist
    // -----------------------------------------------------------------

    /// @notice Allow a specific skill for this agent. If no skills are allowed,
    ///         all skills are permitted (open mode). Adding the first skill
    ///         switches to allowlist mode.
    function allowSkill(address agent, uint256 skillId) external onlyPolicyOwner(agent) {
        if (!_allowedSkills[agent][skillId]) {
            _allowedSkills[agent][skillId] = true;
            _allowlistCount[agent]++;
            emit SkillAllowed(agent, skillId);
        }
    }

    /// @notice Revoke a skill from the agent's allowlist.
    function revokeSkill(address agent, uint256 skillId) external onlyPolicyOwner(agent) {
        if (_allowedSkills[agent][skillId]) {
            _allowedSkills[agent][skillId] = false;
            _allowlistCount[agent]--;
            emit SkillRevoked(agent, skillId);
        }
    }

    // -----------------------------------------------------------------
    //  Core: Check & Record
    // -----------------------------------------------------------------

    /// @notice Check if an agent can spend `amount` on `skillId`, and record
    ///         the spend if allowed. Called by the orchestrator before each payment.
    /// @return remaining USDC remaining in current epoch after this spend
    function checkAndRecord(
        address agent,
        uint256 skillId,
        uint256 amount
    ) external whenNotPaused returns (uint256 remaining) {
        AgentPolicy storage p = _policies[agent];
        if (!p.active) revert PolicyNotFound();

        // Rotate epoch if needed
        if (block.timestamp >= p.currentEpochStart + p.epochDuration) {
            p.currentEpochStart = block.timestamp;
            p.currentEpochSpend = 0;
        }

        // Check allowlist (0 = open mode, all skills allowed)
        if (_allowlistCount[agent] > 0 && !_allowedSkills[agent][skillId]) {
            revert SkillNotAllowed(skillId);
        }

        // Check spending cap
        remaining = p.maxSpendPerEpoch - p.currentEpochSpend;
        if (amount > remaining) {
            revert SpendingCapExceeded(amount, remaining);
        }

        // Record spend
        p.currentEpochSpend += amount;
        remaining = p.maxSpendPerEpoch - p.currentEpochSpend;

        emit SpendRecorded(agent, skillId, amount, p.currentEpochSpend, remaining);
    }

    // -----------------------------------------------------------------
    //  Views
    // -----------------------------------------------------------------

    function getPolicy(address agent) external view returns (AgentPolicy memory) {
        return _policies[agent];
    }

    function getRemainingBudget(address agent) external view returns (uint256) {
        AgentPolicy storage p = _policies[agent];
        if (!p.active) return 0;

        // If epoch expired, full budget available
        if (block.timestamp >= p.currentEpochStart + p.epochDuration) {
            return p.maxSpendPerEpoch;
        }
        return p.maxSpendPerEpoch - p.currentEpochSpend;
    }

    function isSkillAllowed(address agent, uint256 skillId) external view returns (bool) {
        // Open mode: all allowed
        if (_allowlistCount[agent] == 0) return true;
        return _allowedSkills[agent][skillId];
    }

    // -----------------------------------------------------------------
    //  Emergency Brake (Governor only)
    // -----------------------------------------------------------------

    function emergencyPause() external {
        if (msg.sender != governor) revert NotGovernor();
        paused = true;
        emit EmergencyPause(msg.sender);
    }

    function emergencyUnpause() external {
        if (msg.sender != governor) revert NotGovernor();
        paused = false;
        emit EmergencyUnpause(msg.sender);
    }
}
