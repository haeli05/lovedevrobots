"""Claude agent tool definitions.

The agent (Opus 4.7) calls these tools to build an assembly.
Definitions here are passed to the Anthropic API as `tools=[...]`.

See CLAUDE.md for the full tool spec. Implementations come in Week 3.
"""

AGENT_TOOLS = [
    {
        "name": "search_parts",
        "description": (
            "Search the parts catalogue. Use this to find candidate parts for a given role "
            "(e.g. 'small servo with high torque', 'L-bracket', 'ESP32 controller'). "
            "Returns up to max_results parts with SKU, name, key specs, and price."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Free-text search query"},
                "category": {
                    "type": "string",
                    "enum": [
                        "servo",
                        "bracket",
                        "frame",
                        "controller",
                        "gripper",
                        "sensor",
                        "wheel",
                        "motor",
                        "battery",
                        "misc",
                    ],
                },
                "max_results": {"type": "integer", "default": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_part_details",
        "description": "Get the full part record by SKU, including all mount points and specs.",
        "input_schema": {
            "type": "object",
            "properties": {"sku": {"type": "string"}},
            "required": ["sku"],
        },
    },
    {
        "name": "check_compatibility",
        "description": (
            "Check whether two parts can connect via specific mount points. "
            "Returns whether they're compatible and a reason if not."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "part_a_sku": {"type": "string"},
                "mount_a_id": {"type": "string"},
                "part_b_sku": {"type": "string"},
                "mount_b_id": {"type": "string"},
            },
            "required": ["part_a_sku", "mount_a_id", "part_b_sku", "mount_b_id"],
        },
    },
    {
        "name": "add_part",
        "description": (
            "Add a part to the current assembly. If parent_sku is omitted, the part is the root. "
            "Otherwise, it attaches to the parent via the specified mount points."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sku": {"type": "string"},
                "parent_instance_id": {"type": "string"},
                "parent_mount": {"type": "string"},
                "child_mount": {"type": "string"},
            },
            "required": ["sku"],
        },
    },
    {
        "name": "get_assembly_state",
        "description": "Get current assembly: tree of parts, total weight, total cost, DOF count.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "validate_assembly",
        "description": (
            "Run feasibility checks: payload vs joint torques, COG stability, power budget, "
            "required components (controller, power source). Must be called before finalize."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "finalize_assembly",
        "description": (
            "Lock the assembly and generate exports (STEP, URDF, STL, BOM). "
            "Only call after validate_assembly returns ok."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
        },
    },
]


SYSTEM_PROMPT = """You are the assembly agent for lovedevrobots, an AI-powered robot builder.

Your job: given a user's description of a robot they want, build a valid assembly from the parts catalogue.

Workflow:
1. Clarify requirements if critical info is missing (DOF, payload, reach, budget, power source)
2. Use search_parts to find candidate components
3. Use get_part_details to inspect mount points before connecting
4. Use check_compatibility before every add_part call that has a parent
5. Build the assembly incrementally; call get_assembly_state often to track weight/cost
6. Call validate_assembly before finalizing — fix any errors it reports
7. Call finalize_assembly only after validation passes

Hard rules:
- Never connect parts with mismatched connector types. The validator will reject it.
- Every robot needs a controller and a power source. Check before finalizing.
- Stay within the user's stated budget. If you can't, surface the tradeoff explicitly.
- Prefer fewer parts. A 4-DOF arm with 4 servos is better than one with 6 servos when the user wanted simple.
- Use Z-up, X-forward, mm, kg conventions in all reasoning.
"""
