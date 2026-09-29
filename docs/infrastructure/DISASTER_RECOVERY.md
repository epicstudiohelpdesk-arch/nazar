# Disaster Recovery (DR) Plan & Regional Failover

This document defines the Disaster Recovery (DR) strategy, regional failover runbooks, business continuity targets, and escalation procedures for the **Nazar** platform.

---

## 1. Disaster Recovery Classification & Objectives

| Disaster Scenario                          | Target RTO       | Target RPO       | Architectural Defense                                                                        |
| :----------------------------------------- | :--------------- | :--------------- | :------------------------------------------------------------------------------------------- |
| **Availability Zone Outage**               | **< 2 minutes**  | **0 seconds**    | AWS Multi-AZ RDS synchronous replication + Multi-AZ ECS Fargate                              |
| **Regional AWS Outage (`us-east-1`)**      | **< 45 minutes** | **< 5 minutes**  | Warm Standby / Terraform in secondary region (`us-west-2`) + Cross-Region RDS/S3 replication |
| **Database Corruption / Accidental Purge** | **< 30 minutes** | **0–60 seconds** | RDS Point-in-Time Recovery (PITR) with continuous WAL stream                                 |
| **Cloudflare Edge Failure**                | **< 5 minutes**  | **0 seconds**    | Route 53 DNS emergency direct routing to AWS ALB + AWS WAF                                   |

---

## 2. Regional Failover Architecture (`us-east-1` to `us-west-2`)

```mermaid
flowchart TD
    subgraph Edge["Global Edge Routing (Cloudflare)"]
        EdgeDNS[Cloudflare Global Anycast DNS]
    end

    subgraph PrimaryRegion["Primary AWS Region (us-east-1) - ACTIVE"]
        ALBPrimary[Application Load Balancer]
        ECSPrimary[ECS Tasks (API + Worker)]
        RDSPrimary[(RDS PostgreSQL Primary)]
        RedisPrimary[(ElastiCache Redis)]
        S3Primary[(S3 Media Bucket)]
    end

    subgraph SecondaryRegion["Secondary AWS Region (us-west-2) - WARM STANDBY"]
        ALBStandby[Application Load Balancer Standby]
        ECSStandby[ECS Cluster (Desired Tasks = 0)]
        RDSStandby[(RDS Cross-Region Read Replica)]
        S3Standby[(S3 Replicated Media Bucket)]
    end

    EdgeDNS -->|Normal Traffic| ALBPrimary
    ALBPrimary --> ECSPrimary
    ECSPrimary --> RDSPrimary
    ECSPrimary --> S3Primary

    RDSPrimary -.->|Cross-Region Async Stream| RDSStandby
    S3Primary -.->|S3 Cross-Region Replication| S3Standby

    EdgeDNS -.->|DR DNS Repoint| ALBStandby
    ALBStandby -.-> ECSStandby
    ECSStandby -.-> RDSStandby
    ECSStandby -.-> S3Standby
```

---

## 3. Emergency Regional Failover Runbook

### Declaration Authority

Only the **VP of Engineering** or designated **Incident Commander** may authorize regional failover.

### Step 1: Promote Cross-Region RDS Read Replica

In `us-west-2`:

```bash
aws rds promote-read-replica \
  --db-instance-identifier nazar-dr-replica \
  --region us-west-2
```

_Wait for instance status to transition from `modifying` to `available` (typical time: 3–5 minutes)._

### Step 2: Scale Up Compute Tasks in DR Region

```bash
aws ecs update-service \
  --cluster nazar-production-dr \
  --service nazar-api \
  --desired-count 4 \
  --region us-west-2

aws ecs update-service \
  --cluster nazar-production-dr \
  --service nazar-worker \
  --desired-count 2 \
  --region us-west-2
```

### Step 3: Repoint Edge DNS (Cloudflare)

Update Cloudflare DNS records for `api.nazar.app` to direct origin traffic to the secondary ALB:

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"api.nazar.app","content":"nazar-alb-dr-987654.us-west-2.elb.amazonaws.com","ttl":60,"proxied":true}'
```

### Step 4: Run Post-Failover Verification

Execute the automated smoke test against the DR environment:

```bash
BASE_URL="https://api.nazar.app" pnpm --filter @platform/api test:smoke
```

---

## 4. Disaster Recovery Drills & Testing Schedule

1. **Quarterly Tabletop Simulation**: Architecture and ops team walk through failure scenarios, verify IAM permissions, and review runbooks.
2. **Bi-Annual Standby Spin-Up Drill**: Spin up the standby ECS cluster, promote a cloned RDS snapshot in `us-west-2`, execute end-to-end smoke tests against the secondary region, and tear down without diverting live traffic.
3. **Audit Reporting**: Results and measured RTO/RPO times are recorded in the engineering compliance ledger.
