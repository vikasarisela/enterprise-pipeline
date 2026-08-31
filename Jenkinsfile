pipeline {
    agent any
    
    environment {
        // Dynamic Pipeline Variables
        AWS_ACCOUNT_ID = '123456789012' // Replace with your AWS ID
        AWS_REGION     = 'us-east-1'
        ECR_REPO_NAME  = 'enterprise-pipeline'
        GITHUB_ORG     = 'your-github-username'
        GITHUB_REPO    = 'enterprise-pipeline'
        
        // Secured Credentials from Jenkins Config
        GITHUB_TOKEN   = credentials('github-token')
        SONAR_TOKEN    = credentials('sonar-token')
    }
    
    stages {
        stage('1. Checkout Code') {
            steps {
                checkout scm
            }
        }
        
        stage('2. Security Gate: Dependabot Check') {
            steps {
                script {
                    echo "Querying GitHub API for active Dependabot Vulnerabilities..."
                    
                    // Calls GitHub API to check for open critical/high security vulnerability alerts
                    def response = sh(
                        script: "curl -s -H 'Authorization: token ${GITHUB_TOKEN}' https://github.com{GITHUB_ORG}/${GITHUB_REPO}/dependabot/alerts",
                        returnStdout: true
                    ).trim()
                    
                    // Simple parsing using jq to verify if any open high/critical hazards remain unpatched
                    def alertCount = sh(
                        script: "echo '${response}' | jq '[.[] | select(.state == \"open\" and (.security_advisory.severity == \"critical\" or .security_advisory.severity == \"high\"))] | length'",
                        returnStdout: true
                    ).trim().toInteger()

                    if (alertCount > 0) {
                        error "PIPELINE ABORTED: Dependabot found ${alertCount} unresolved high/critical security flaws in third-party libraries."
                    } else {
                        echo "Dependabot Gate Passed: 0 critical/high third-party vulnerabilities found."
                    }
                }
            }
        }
        
        stage('3. Quality Gate 1: Run Unit Tests') {
            steps {
                sh 'npm install'
                // Runs Jest tests and outputs a coverage report directory
                sh 'npm test' 
            }
        }
        
        stage('4. Quality Gate 2: SonarQube Static Analysis') {
            steps {
                // Evaluates custom code structure, bugs, and imports test coverage data
                withSonarQubeEnv('MySonarQubeServer') { 
                    sh "sonar-scanner -Dsonar.token=${SONAR_TOKEN}"
                }
            }
        }
        
        stage('5. Quality Gate 2 Verification: Wait for Sonar') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    script {
                        // Pauses pipeline until SonarQube finishes analyzing and sends webhook status
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            error "PIPELINE ABORTED: SonarQube Quality Gate Failed. Status: ${qg.status}"
                        }
                        echo "SonarQube Quality Gate Passed successfully."
                    }
                }
            }
        }
        
        stage('6. Package: Build Container Image') {
            steps {
                echo "Packaging verified application into an immutable Docker image..."
                sh "docker build -t ${ECR_REPO_NAME}:${env.BUILD_NUMBER} ."
                sh "docker tag ${ECR_REPO_NAME}:${env.BUILD_NUMBER} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}://{ECR_REPO_NAME}:${env.BUILD_NUMBER}"
                sh "docker tag ${ECR_REPO_NAME}:${env.BUILD_NUMBER} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}://{ECR_REPO_NAME}:latest"
            }
        }
        
        stage('7. Ship: Push Image to AWS ECR') {
            steps {
                script {
                    echo "Authenticating Jenkins engine with AWS ECR..."
                    sh "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
                    
                    echo "Uploading image artifacts to AWS ECR registry..."
                    sh "docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}://{ECR_REPO_NAME}:${env.BUILD_NUMBER}"
                    sh "docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}://{ECR_REPO_NAME}:latest"
                }
            }
        }
    }
    
    post {
        always {
            echo "Cleaning up local workspace images..."
            sh "docker rmi -f ${ECR_REPO_NAME}:${env.BUILD_NUMBER} || true"
        }
        success {
            echo "Pipeline Completed Successfully! Verified image is now live on AWS ECR."
        }
        failure {
            echo "Pipeline Failed. Please check the logs above to identify which Security or Quality gate tripped."
        }
    }
}
