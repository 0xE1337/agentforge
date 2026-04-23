// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title SkillRegistry — Agent Skill Marketplace catalog on Arc
/// @notice Agents register skills with USDC pricing; callers discover and rate skills 1-5.
///         Adapted from AG4 for Circle Nanopayments hackathon.
contract SkillRegistry {
    // -----------------------------------------------------------------
    //  Types
    // -----------------------------------------------------------------

    struct Skill {
        address owner;
        string name;
        string description;
        string endpoint;
        uint256 priceUSDC; // 6 decimals (ERC-20 USDC on Arc)
        string[] tags;
        uint256 totalRating;
        uint256 ratingCount;
        bool active;
        uint256 createdAt;
    }

    // -----------------------------------------------------------------
    //  Storage
    // -----------------------------------------------------------------

    address public immutable governor;
    uint256 private _skillCount;

    /// @dev skillId => Skill (1-indexed)
    mapping(uint256 => Skill) private _skills;

    /// @dev skillId => rater => bool
    mapping(uint256 => mapping(address => bool)) private _hasRated;

    // -----------------------------------------------------------------
    //  Events
    // -----------------------------------------------------------------

    event SkillRegistered(uint256 indexed skillId, address indexed owner, string name, uint256 priceUSDC);
    event SkillUpdated(uint256 indexed skillId, uint256 newPrice);
    event SkillRated(uint256 indexed skillId, address indexed rater, uint8 rating);
    event SkillDeactivated(uint256 indexed skillId, address indexed deactivatedBy);

    // -----------------------------------------------------------------
    //  Errors
    // -----------------------------------------------------------------

    error NotOwner();
    error SkillInactive();
    error AlreadyRated();
    error InvalidRating();
    error SkillNotFound();
    error NotGovernor();

    // -----------------------------------------------------------------
    //  Constructor
    // -----------------------------------------------------------------

    constructor(address _governor) {
        governor = _governor;
    }

    // -----------------------------------------------------------------
    //  Modifiers
    // -----------------------------------------------------------------

    modifier onlySkillOwner(uint256 skillId) {
        _requireExists(skillId);
        if (_skills[skillId].owner != msg.sender) revert NotOwner();
        _;
    }

    modifier onlyActive(uint256 skillId) {
        _requireExists(skillId);
        if (!_skills[skillId].active) revert SkillInactive();
        _;
    }

    // -----------------------------------------------------------------
    //  External — mutations
    // -----------------------------------------------------------------

    /// @notice Register a new skill in the catalog.
    function registerSkill(
        string calldata name,
        string calldata description,
        string calldata endpoint,
        uint256 priceInUSDC,
        string[] calldata tags
    ) external returns (uint256 skillId) {
        skillId = ++_skillCount;
        Skill storage s = _skills[skillId];
        s.owner = msg.sender;
        s.name = name;
        s.description = description;
        s.endpoint = endpoint;
        s.priceUSDC = priceInUSDC;
        s.active = true;
        s.createdAt = block.timestamp;
        for (uint256 i; i < tags.length; ++i) {
            s.tags.push(tags[i]);
        }
        emit SkillRegistered(skillId, msg.sender, name, priceInUSDC);
    }

    /// @notice Update the USDC price of an existing skill (owner only).
    function updatePrice(uint256 skillId, uint256 newPrice) external onlySkillOwner(skillId) onlyActive(skillId) {
        _skills[skillId].priceUSDC = newPrice;
        emit SkillUpdated(skillId, newPrice);
    }

    /// @notice Rate a skill 1-5. Each caller may rate a given skill only once.
    function rateSkill(uint256 skillId, uint8 rating) external onlyActive(skillId) {
        if (rating < 1 || rating > 5) revert InvalidRating();
        if (_hasRated[skillId][msg.sender]) revert AlreadyRated();

        _hasRated[skillId][msg.sender] = true;
        _skills[skillId].totalRating += rating;
        _skills[skillId].ratingCount += 1;

        emit SkillRated(skillId, msg.sender, rating);
    }

    /// @notice Deactivate a skill (owner only).
    function deactivateSkill(uint256 skillId) external onlySkillOwner(skillId) onlyActive(skillId) {
        _skills[skillId].active = false;
        emit SkillDeactivated(skillId, msg.sender);
    }

    /// @notice Governor emergency deactivation.
    function emergencyDeactivate(uint256 skillId) external onlyActive(skillId) {
        if (msg.sender != governor) revert NotGovernor();
        _skills[skillId].active = false;
        emit SkillDeactivated(skillId, msg.sender);
    }

    // -----------------------------------------------------------------
    //  External — views
    // -----------------------------------------------------------------

    function getSkill(uint256 skillId) external view returns (Skill memory) {
        _requireExists(skillId);
        return _skills[skillId];
    }

    function skillCount() external view returns (uint256) {
        return _skillCount;
    }

    /// @notice Return all active skills — used by Orchestrator Agent for discovery.
    function getActiveSkills() external view returns (uint256[] memory ids, Skill[] memory skills) {
        uint256 total = _skillCount;
        uint256 activeCount;
        for (uint256 i = 1; i <= total; ++i) {
            if (_skills[i].active) ++activeCount;
        }

        ids = new uint256[](activeCount);
        skills = new Skill[](activeCount);
        uint256 idx;
        for (uint256 i = 1; i <= total; ++i) {
            if (_skills[i].active) {
                ids[idx] = i;
                skills[idx] = _skills[i];
                ++idx;
            }
        }
    }

    // -----------------------------------------------------------------
    //  Internal helpers
    // -----------------------------------------------------------------

    function _requireExists(uint256 skillId) internal view {
        if (skillId == 0 || skillId > _skillCount) revert SkillNotFound();
    }
}
