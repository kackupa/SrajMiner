using System.Collections.Generic;
using UnityEngine;

// A self-contained, original vertical slice. Press Play in the included scene.
public sealed class ShipAssault : MonoBehaviour
{
    static ShipAssault game;
    readonly List<Guard> guards = new List<Guard>();
    readonly List<Transform> doors = new List<Transform>();
    Transform player;
    Transform captain;
    Camera view;
    Material floorMat, wallMat, trimMat, playerMat, guardMat, captainMat, bladeMat, boltMat;
    Vector3 velocity;
    float hp = 100, shotReady, slashReady, pulseReady, damageFlash;
    int checkpoint;
    bool won, lost;
    const float Speed = 5.2f;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void StartGame()
    {
        if (FindObjectOfType<ShipAssault>() == null)
            new GameObject("Ship Assault").AddComponent<ShipAssault>();
    }

    void Awake()
    {
        if (game != null && game != this) { Destroy(gameObject); return; }
        game = this;
        floorMat = Mat(new Color(.095f, .14f, .18f));
        wallMat = Mat(new Color(.23f, .3f, .35f));
        trimMat = Mat(new Color(.95f, .52f, .19f));
        playerMat = Mat(new Color(.16f, .64f, .75f));
        guardMat = Mat(new Color(.72f, .24f, .19f));
        captainMat = Mat(new Color(.84f, .65f, .25f));
        bladeMat = Mat(new Color(.19f, .9f, .95f));
        boltMat = Mat(new Color(1f, .5f, .19f));
        BuildShip();
        player = Capsule("Boarder", new Vector3(0, 1, 2), playerMat).transform;
        captain = Capsule("Captain", new Vector3(0, 1, 55), captainMat).transform;
        captain.localScale = new Vector3(1.2f, 1.1f, 1.2f);
        SpawnGuard(-1.8f, 13); SpawnGuard(1.7f, 19);
        SpawnGuard(-1.7f, 31); SpawnGuard(1.8f, 37);
        SpawnGuard(-1.7f, 48); SpawnGuard(1.7f, 51);
        var cameraObject = new GameObject("Tactical camera");
        view = cameraObject.AddComponent<Camera>();
        view.orthographic = true;
        view.orthographicSize = 11;
        view.transform.rotation = Quaternion.Euler(58, 0, 0);
        view.backgroundColor = new Color(.025f, .05f, .08f);
        cameraObject.AddComponent<AudioListener>();
        var lightObject = new GameObject("Ship lighting");
        var light = lightObject.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 1.25f;
        lightObject.transform.rotation = Quaternion.Euler(55, -25, 0);
    }

    static Material Mat(Color color)
    {
        var shader = Shader.Find("Standard");
        var material = new Material(shader) { color = color };
        return material;
    }

    GameObject Box(string name, Vector3 position, Vector3 scale, Material material)
    {
        var obj = GameObject.CreatePrimitive(PrimitiveType.Cube);
        obj.name = name; obj.transform.position = position; obj.transform.localScale = scale;
        obj.GetComponent<Renderer>().material = material;
        return obj;
    }

    GameObject Capsule(string name, Vector3 position, Material material)
    {
        var obj = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        obj.name = name; obj.transform.position = position;
        obj.GetComponent<Renderer>().material = material;
        return obj;
    }

    void BuildShip()
    {
        Box("Deck", new Vector3(0, -.3f, 29), new Vector3(10, .5f, 60), floorMat);
        Box("Port bulkhead", new Vector3(-5, 1.3f, 29), new Vector3(.35f, 2.7f, 60), wallMat);
        Box("Starboard bulkhead", new Vector3(5, 1.3f, 29), new Vector3(.35f, 2.7f, 60), wallMat);
        Box("Airlock", new Vector3(0, 1.3f, -1), new Vector3(10, 2.7f, .4f), wallMat);
        Box("Bridge windows", new Vector3(0, 1.3f, 59), new Vector3(10, 2.7f, .4f), wallMat);
        foreach (int z in new[] { 26, 43, 53 })
        {
            Box("Port frame", new Vector3(-3.5f, 1.2f, z), new Vector3(3, 2.4f, .45f), wallMat);
            Box("Starboard frame", new Vector3(3.5f, 1.2f, z), new Vector3(3, 2.4f, .45f), wallMat);
            var door = Box("Security shutter", new Vector3(0, 1.2f, z), new Vector3(4, 2.4f, .35f), trimMat).transform;
            doors.Add(door);
        }
        for (int z = 4; z < 58; z += 5)
        {
            Box("Port light", new Vector3(-4.75f, .05f, z), new Vector3(.25f, .12f, 2), trimMat);
            Box("Starboard light", new Vector3(4.75f, .05f, z), new Vector3(.25f, .12f, 2), trimMat);
        }
        Box("Bridge console", new Vector3(0, .45f, 57), new Vector3(3.5f, .9f, 1), trimMat);
        Box("Port console", new Vector3(-3.5f, .45f, 55), new Vector3(1.2f, .9f, 3), wallMat);
        Box("Starboard console", new Vector3(3.5f, .45f, 55), new Vector3(1.2f, .9f, 3), wallMat);
    }

    void SpawnGuard(float x, float z) { guards.Add(new Guard(Capsule("Ship security", new Vector3(x, 1, z), guardMat).transform, z)); }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.R) && (won || lost)) { UnityEngine.SceneManagement.SceneManager.LoadScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene().buildIndex); return; }
        if (won || lost) return;
        float dt = Time.deltaTime;
        shotReady -= dt; slashReady -= dt; pulseReady -= dt; damageFlash -= dt;
        Vector3 input = new Vector3(Input.GetAxisRaw("Horizontal"), 0, Input.GetAxisRaw("Vertical"));
        input = Vector3.ClampMagnitude(input, 1);
        velocity = Vector3.MoveTowards(velocity, input * Speed, 24 * dt);
        Move(player, velocity * dt);
        Vector3 aim = AimDirection();
        if (aim.sqrMagnitude > .01f) player.rotation = Quaternion.LookRotation(aim);
        if (Input.GetMouseButton(0) && shotReady <= 0) Shoot(aim);
        if ((Input.GetMouseButtonDown(1) || Input.GetKeyDown(KeyCode.Space)) && slashReady <= 0) Slash(aim);
        if (Input.GetKeyDown(KeyCode.F) && pulseReady <= 0) Pulse();
        for (int i = guards.Count - 1; i >= 0; i--) UpdateGuard(guards[i], dt);
        for (int i = 0; i < doors.Count; i++)
        {
            if (checkpoint > i && doors[i].gameObject.activeSelf) doors[i].gameObject.SetActive(false);
            if (checkpoint == i && !AreaHasGuards(i) && player.position.z > new[] { 22, 39, 48 }[i]) checkpoint++;
        }
        if (checkpoint == 3 && Vector3.Distance(player.position, captain.position) < 2.5f && Input.GetKeyDown(KeyCode.E)) won = true;
        view.transform.position = Vector3.Lerp(view.transform.position, player.position + new Vector3(0, 16, -10), Mathf.Clamp01(dt * 5));
    }

    bool AreaHasGuards(int area)
    {
        float min = new[] { 0f, 26f, 43f }[area];
        float max = new[] { 26f, 43f, 59f }[area];
        foreach (var guard in guards) if (guard.hp > 0 && guard.homeZ >= min && guard.homeZ < max) return true;
        return false;
    }

    Vector3 AimDirection()
    {
        Ray ray = view.ScreenPointToRay(Input.mousePosition);
        Plane plane = new Plane(Vector3.up, new Vector3(0, 1, 0));
        if (plane.Raycast(ray, out float distance))
        {
            Vector3 direction = ray.GetPoint(distance) - player.position; direction.y = 0;
            if (direction.sqrMagnitude > .1f) return direction.normalized;
        }
        return player.forward;
    }

    void Shoot(Vector3 direction)
    {
        shotReady = .28f;
        Ray ray = new Ray(player.position + Vector3.up * .2f, direction);
        if (Physics.Raycast(ray, out RaycastHit hit, 14))
            foreach (var guard in guards) if (guard.hp > 0 && hit.transform == guard.body) { Hurt(guard, 20); break; }
        StartCoroutine(Flash(player.position + direction, direction, boltMat, .12f));
    }

    void Slash(Vector3 direction)
    {
        slashReady = .7f;
        foreach (var guard in guards)
        {
            Vector3 delta = guard.body.position - player.position; delta.y = 0;
            if (guard.hp > 0 && delta.magnitude < 2.5f && Vector3.Dot(direction, delta.normalized) > .25f) Hurt(guard, 52);
        }
        StartCoroutine(Flash(player.position + direction * 1.3f, direction, bladeMat, .25f));
    }

    void Pulse()
    {
        pulseReady = 5;
        foreach (var guard in guards)
        {
            Vector3 delta = guard.body.position - player.position; delta.y = 0;
            if (guard.hp > 0 && delta.magnitude < 5)
            {
                Hurt(guard, 28);
                guard.stunned = 2.4f;
                Move(guard.body, delta.normalized * 2.5f);
            }
        }
        StartCoroutine(Flash(player.position, Vector3.one, bladeMat, .35f));
    }

    System.Collections.IEnumerator Flash(Vector3 position, Vector3 direction, Material material, float duration)
    {
        var flash = Box("Combat effect", position, new Vector3(.18f, .18f, direction == Vector3.one ? 5 : 1.5f), material);
        flash.GetComponent<Collider>().enabled = false;
        if (direction != Vector3.one) flash.transform.rotation = Quaternion.LookRotation(direction);
        yield return new WaitForSeconds(duration);
        Destroy(flash);
    }

    void Hurt(Guard guard, float damage)
    {
        guard.hp -= damage;
        if (guard.hp <= 0) { guard.body.gameObject.SetActive(false); }
    }

    void UpdateGuard(Guard guard, float dt)
    {
        if (guard.hp <= 0) return;
        if (guard.stunned > 0) { guard.stunned -= dt; return; }
        Vector3 delta = player.position - guard.body.position; delta.y = 0;
        if (delta.magnitude > 9 || delta.magnitude < 1.8f) return;
        if (checkpoint < 3 && guard.homeZ >= new[] { 26, 43, 59 }[checkpoint]) return;
        guard.body.rotation = Quaternion.LookRotation(delta);
        if (delta.magnitude > 4) Move(guard.body, delta.normalized * 2.1f * dt);
        guard.attack -= dt;
        if (guard.attack <= 0 && Physics.Raycast(guard.body.position, delta.normalized, out RaycastHit hit, 9) && hit.transform == player)
        {
            guard.attack = 1.1f;
            hp -= 8; damageFlash = .2f;
            if (hp <= 0) { hp = 0; lost = true; }
            StartCoroutine(Flash(guard.body.position + delta.normalized, delta.normalized, boltMat, .12f));
        }
    }

    void Move(Transform actor, Vector3 distance)
    {
        Vector3 target = actor.position + distance;
        target.x = Mathf.Clamp(target.x, -4.4f, 4.4f);
        target.z = Mathf.Clamp(target.z, .8f, 57.5f);
        // Slide along the door until this compartment is secured.
        foreach (var door in doors)
        {
            if (!door.gameObject.activeSelf && Mathf.Abs(target.x) < 1.8f) continue;
            float near = door.position.z - .65f;
            float far = door.position.z + .65f;
            if (actor.position.z <= near && target.z > near) target.z = near;
            else if (actor.position.z >= far && target.z < far) target.z = far;
            else if (actor.position.z > near && actor.position.z < far)
                target.z = actor.position.z < door.position.z ? near : far;
        }
        actor.position = target;
    }

    void OnGUI()
    {
        GUI.color = damageFlash > 0 ? new Color(1, .5f, .5f) : Color.white;
        GUI.skin.label.fontSize = 20;
        GUI.Label(new Rect(20, 16, 650, 35), "ORE FRONTIER // BOARDING ACTION");
        GUI.skin.label.fontSize = 15;
        GUI.Label(new Rect(20, 52, 800, 28), "WASD move   Mouse aim   LMB blaster   RMB / Space blade   F gravity pulse");
        GUI.Label(new Rect(20, 78, 700, 28), "Hull " + Mathf.CeilToInt(hp) + "   |   Pulse " + (pulseReady <= 0 ? "READY" : Mathf.CeilToInt(pulseReady) + "s") + "   |   Deck " + (checkpoint + 1) + "/4");
        if (won || lost)
        {
            GUI.skin.label.fontSize = 32;
            GUI.Label(new Rect(Screen.width / 2 - 190, Screen.height / 2 - 45, 480, 90), won ? "BRIDGE SECURED" : "BOARDING FAILED");
            GUI.skin.label.fontSize = 18;
            GUI.Label(new Rect(Screen.width / 2 - 100, Screen.height / 2 + 12, 260, 40), "Press R to restart");
        }
        else if (checkpoint == 3 && Vector3.Distance(player.position, captain.position) < 2.5f)
            GUI.Label(new Rect(Screen.width / 2 - 170, Screen.height - 80, 400, 40), "E  Override captain's command");
        else GUI.Label(new Rect(20, Screen.height - 48, 760, 35), checkpoint < 3 ? "Clear security to open the next shutter." : "Reach the captain at the front of the bridge.");
    }

    sealed class Guard
    {
        public readonly Transform body;
        public readonly float homeZ;
        public float hp = 80, stunned, attack;
        public Guard(Transform body, float homeZ) { this.body = body; this.homeZ = homeZ; }
    }
}
