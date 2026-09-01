pipeline {
    agent { label 'AGENT-1' } // ◄ Forces everything to execute exclusively on your worker node
    
    environment {
        AWS_ACCOUNT_ID = '193849563622' // Replace with your true AWS Account ID
        AWS_REGION     = 'us-east-1'
        ECR_REPO_NAME  = 'enterprise-pipeline'
        GITHUB_ORG     = 'vikasarisela'
        GITHUB_REPO    = 'enterprise-pipeline'
        
        // Pulled securely from Jenkins Master Credentials Store
        GITHUB_TOKEN   = credentials('github-token')
        SONAR_TOKEN    = credentials('sonar-token')
    }
    
    stages {
        stage('1. Fetch Source Code') {
            steps {
                checkout scm
            }
        }
        
        stage('2. Security Gate: Dependabot Check') {
            steps {
                script {
                    echo "Querying GitHub Security API for active dependency risks..."
                    
                    def response = sh(
                        script: "curl -s -H 'Authorization: token ${GITHUB_TOKEN}' https://github.com{GITHUB_ORG}/${GITHUB_REPO}/dependabot/alerts",
                        returnStdout: true
                    ).trim()
                    
                    // JQ command acts as the filter—ignoring closed alerts, counting only high/critical status
                    def alertCount = sh(
                        script: "echo '${response}' | jq '[.[] | select(.state == \"open\" and (.security_advisory.severity == \"critical\" or .security_advisory.severity == \"high\"))] | length'",
                        returnStdout: true
                    ).trim().toInteger()

                    if (alertCount > 0) {
                        error "PIPELINE ABORTED: Security Gate Failed! Dependabot found ${alertCount} unresolved high/critical risks."
                    }
                    echo "Dependabot Check Passed: 0 open critical/high flaws."
                }
            }
        }
        
        stage('3. Quality Gate 1: Run Unit Tests') {
            steps {
                sh 'npm install'
                sh 'npm test' // Executes Jest testing logic and prints code metrics to coverage/lcov.info
            }
        }
        
        stage('4. Quality Gate 2: SonarQube Static Analysis') {
            steps {
                withSonarQubeEnv('MySonarQubeServer') { 
                    sh "sonar-scanner -Dsonar.token=${SONAR_TOKEN}"
                }
            }
        }
        
        stage('5. Verification: Await SonarQube Callback') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    script {
                        // Pauses pipeline until SonarQube Webhook confirms Quality Gate evaluation status back to master
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            error "PIPELINE ABORTED: SonarQube Quality Gate Defeated. Status: ${qg.status}"
                        }
                        echo "SonarQube Quality Gate Verified: OK."
                    }
                }
            }
        }
        
        stage('6. Package: Compile Container Image') {
            steps {
                echo "Packaging verified application binaries into clean Docker container layers..."
                sh "docker build -t ${ECR_REPO_NAME}:${env.BUILD_NUMBER} ."
                sh "docker tag ${ECR_REPO_NAME}:${env.BUILD_NUMBER} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}://{ECR_REPO_NAME}:${env.BUILD_NUMBER}"
                sh "docker tag ${ECR_REPO_NAME}:${env.BUILD_NUMBER} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}://{ECR_REPO_NAME}:latest"
            }
        }
        
        stage('7. Ship: Push Image to AWS ECR') {
            steps {
                script {
                    echo "Authenticating worker machine Docker subsystem with ECR..."
                    sh "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
                    
                    echo "Pushing tagged image versions up to the cloud registry..."
                    sh "docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}://{ECR_REPO_NAME}:${env.BUILD_NUMBER}"
                    sh "docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}://{ECR_REPO_NAME}:latest"
                }
            }
        }
    }
    
    post {
        always {
            echo "Wiping temporary local docker container footprints from worker node..."
            sh "docker rmi -f ${ECR_REPO_NAME}:${env.BUILD_NUMBER} || true"
        }
        success {
            echo "Success! Image securely passed all gates and is uploaded to AWS ECR."
        }
    }
}
