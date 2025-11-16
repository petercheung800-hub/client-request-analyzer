import './AnalysisResult.css'

function AnalysisResult({ analysis }) {
  if (!analysis || !analysis.analysis) {
    return null
  }

  const data = analysis.analysis

  return (
    <div className="analysis-result">
      <div className="result-header">
        <h2>分析结果</h2>
        {analysis.clientName && (
          <span className="client-badge">{analysis.clientName}</span>
        )}
        {analysis.createdAt && (
          <span className="date-badge">
            {new Date(analysis.createdAt).toLocaleString('zh-CN')}
          </span>
        )}
      </div>

      {data.summary && (
        <Section title="项目概述">
          <p className="summary-text">{data.summary}</p>
        </Section>
      )}

      {data.requirements && (
        <Section title="项目需求">
          <div className="requirements-grid">
            {data.requirements.functional && data.requirements.functional.length > 0 && (
              <div className="requirement-group">
                <h4>功能需求</h4>
                <ul>
                  {data.requirements.functional.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.requirements.nonFunctional && data.requirements.nonFunctional.length > 0 && (
              <div className="requirement-group">
                <h4>非功能需求</h4>
                <ul>
                  {data.requirements.nonFunctional.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      {data.feasibility && (
        <Section title="可行性分析">
          <div className="feasibility-content">
            {data.feasibility.technical && (
              <div className="feasibility-item">
                <h4>技术可行性</h4>
                <p>{data.feasibility.technical}</p>
              </div>
            )}
            {data.feasibility.time && (
              <div className="feasibility-item">
                <h4>时间可行性</h4>
                <p>{data.feasibility.time}</p>
              </div>
            )}
            {data.feasibility.resource && (
              <div className="feasibility-item">
                <h4>资源可行性</h4>
                <p>{data.feasibility.resource}</p>
              </div>
            )}
            {data.feasibility.overall && (
              <div className="feasibility-overall">
                <strong>总体评估：</strong>
                <span className={`overall-badge ${getFeasibilityClass(data.feasibility.overall)}`}>
                  {data.feasibility.overall}
                </span>
              </div>
            )}
          </div>
        </Section>
      )}

      {data.techStack && (
        <Section title="技术栈建议">
          <div className="tech-stack-content">
            {data.techStack.frontend && data.techStack.frontend.length > 0 && (
              <div className="tech-group">
                <h4>前端技术</h4>
                <div className="tech-tags">
                  {data.techStack.frontend.map((tech, idx) => (
                    <span key={idx} className="tech-tag">{tech}</span>
                  ))}
                </div>
              </div>
            )}
            {data.techStack.backend && data.techStack.backend.length > 0 && (
              <div className="tech-group">
                <h4>后端技术</h4>
                <div className="tech-tags">
                  {data.techStack.backend.map((tech, idx) => (
                    <span key={idx} className="tech-tag">{tech}</span>
                  ))}
                </div>
              </div>
            )}
            {data.techStack.database && data.techStack.database.length > 0 && (
              <div className="tech-group">
                <h4>数据库</h4>
                <div className="tech-tags">
                  {data.techStack.database.map((tech, idx) => (
                    <span key={idx} className="tech-tag">{tech}</span>
                  ))}
                </div>
              </div>
            )}
            {data.techStack.other && data.techStack.other.length > 0 && (
              <div className="tech-group">
                <h4>其他技术</h4>
                <div className="tech-tags">
                  {data.techStack.other.map((tech, idx) => (
                    <span key={idx} className="tech-tag">{tech}</span>
                  ))}
                </div>
              </div>
            )}
            {data.techStack.reasoning && (
              <div className="tech-reasoning">
                <h4>选型理由</h4>
                <p>{data.techStack.reasoning}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {data.timeline && (
        <Section title="开发周期和步骤">
          <div className="timeline-content">
            {data.timeline.phases && data.timeline.phases.map((phase, idx) => (
              <div key={idx} className="phase-item">
                <div className="phase-header">
                  <span className="phase-number">{idx + 1}</span>
                  <h4>{phase.name}</h4>
                  <span className="phase-duration">{phase.duration}</span>
                </div>
                {phase.tasks && phase.tasks.length > 0 && (
                  <ul className="phase-tasks">
                    {phase.tasks.map((task, taskIdx) => (
                      <li key={taskIdx}>{task}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {data.timeline.totalDuration && (
              <div className="total-duration">
                <strong>总开发周期：</strong>
                <span className="duration-badge">{data.timeline.totalDuration}</span>
              </div>
            )}
          </div>
        </Section>
      )}

      {data.risks && data.risks.length > 0 && (
        <Section title="风险分析">
          <div className="risks-content">
            {data.risks.map((risk, idx) => (
              <div key={idx} className="risk-item">
                <div className="risk-header">
                  <h4>{risk.type}</h4>
                  <span className={`risk-impact ${getRiskClass(risk.impact)}`}>
                    {risk.impact}
                  </span>
                </div>
                <p className="risk-description">{risk.description}</p>
                {risk.mitigation && (
                  <div className="risk-mitigation">
                    <strong>应对措施：</strong>
                    <p>{risk.mitigation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.teamMembers && (
        <Section title="项目成员分析">
          <div className="team-members-content">
            {data.teamMembers.teamStructure && (
              <div className="team-structure">
                <h4>团队结构</h4>
                <p>{data.teamMembers.teamStructure}</p>
                {data.teamMembers.totalCount && (
                  <div className="total-count">
                    <strong>总人数：</strong>
                    <span className="count-badge">{data.teamMembers.totalCount}</span>
                  </div>
                )}
              </div>
            )}
            {data.teamMembers.roles && data.teamMembers.roles.length > 0 && (
              <div className="team-roles">
                <h4>角色配置</h4>
                <div className="roles-grid">
                  {data.teamMembers.roles.map((role, idx) => (
                    <div key={idx} className="role-item">
                      <div className="role-header">
                        <h5>{role.role}</h5>
                        <span className="role-count">{role.count}</span>
                        {role.level && (
                          <span className={`role-level ${getLevelClass(role.level)}`}>
                            {role.level}
                          </span>
                        )}
                      </div>
                      {role.skills && role.skills.length > 0 && (
                        <div className="role-skills">
                          <strong>所需技能：</strong>
                          <div className="skills-tags">
                            {role.skills.map((skill, skillIdx) => (
                              <span key={skillIdx} className="skill-tag">{skill}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {role.responsibilities && role.responsibilities.length > 0 && (
                        <div className="role-responsibilities">
                          <strong>主要职责：</strong>
                          <ul>
                            {role.responsibilities.map((resp, respIdx) => (
                              <li key={respIdx}>{resp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.teamMembers.keyRequirements && data.teamMembers.keyRequirements.length > 0 && (
              <div className="team-requirements">
                <h4>关键要求</h4>
                <ul>
                  {data.teamMembers.keyRequirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      {data.pricing && (
        <Section title="报价分析">
          <div className="pricing-content">
            {data.pricing.estimation && (
              <div className="pricing-estimation">
                <h4>报价估算</h4>
                <div className="estimation-badge">{data.pricing.estimation}</div>
              </div>
            )}
            {data.pricing.breakdown && (
              <div className="pricing-breakdown">
                <h4>成本分解</h4>
                <div className="breakdown-grid">
                  {data.pricing.breakdown.development && (
                    <div className="breakdown-item">
                      <strong>开发成本</strong>
                      <p>{data.pricing.breakdown.development}</p>
                    </div>
                  )}
                  {data.pricing.breakdown.testing && (
                    <div className="breakdown-item">
                      <strong>测试成本</strong>
                      <p>{data.pricing.breakdown.testing}</p>
                    </div>
                  )}
                  {data.pricing.breakdown.deployment && (
                    <div className="breakdown-item">
                      <strong>部署成本</strong>
                      <p>{data.pricing.breakdown.deployment}</p>
                    </div>
                  )}
                  {data.pricing.breakdown.maintenance && (
                    <div className="breakdown-item">
                      <strong>维护成本</strong>
                      <p>{data.pricing.breakdown.maintenance}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {data.pricing.factors && data.pricing.factors.length > 0 && (
              <div className="pricing-factors">
                <h4>影响报价的因素</h4>
                <ul>
                  {data.pricing.factors.map((factor, idx) => (
                    <li key={idx}>{factor}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="result-section">
      <h3 className="section-title">{title}</h3>
      <div className="section-content">{children}</div>
    </div>
  )
}

function getFeasibilityClass(overall) {
  if (overall.includes('可行')) return 'feasible'
  if (overall.includes('不可行')) return 'infeasible'
  return 'evaluate'
}

function getRiskClass(impact) {
  if (impact === '高') return 'high'
  if (impact === '中') return 'medium'
  return 'low'
}

function getLevelClass(level) {
  if (level.includes('高级') || level.includes('Senior')) return 'senior'
  if (level.includes('中级') || level.includes('Middle')) return 'middle'
  return 'junior'
}

export default AnalysisResult

